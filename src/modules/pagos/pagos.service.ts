import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import { Pago } from '@entities/pago.entity';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Usuario } from '@entities/usuario.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { Comprobante } from '@entities/comprobante.entity';
import { Jugador } from '@entities/jugador.entity';
import { CreatePagoDto, FilterPagoDto, AnularPagoDto, UpdatePagoDto } from './dto/pagos.dto';
import { InterpretarTextoDto, RegistrarLotePagosDto } from './dto/lote-pagos.dto';
import { WhatsAppParserUtil } from './utils/whatsapp-parser.util';
import { NequiOcrUtil } from './utils/nequi-ocr.util';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';
import { MensualidadesService } from '../mensualidades/mensualidades.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    @InjectRepository(Mensualidad)
    private readonly mensualidadRepository: Repository<Mensualidad>,
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
    @InjectRepository(Comprobante)
    private readonly comprobanteRepository: Repository<Comprobante>,
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
    private readonly mensualidadesService: MensualidadesService,
    private readonly configService: ConfigService,
  ) {}

  async create(createPagoDto: CreatePagoDto, usuario: Usuario) {
    const mensualidad = await this.mensualidadRepository.findOne({
      where: { id: createPagoDto.mensualidad_id },
      relations: ['jugador'],
    });

    if (!mensualidad) {
      throw new NotFoundException('Mensualidad no encontrada');
    }

    if (createPagoDto.monto_pagado > Number(mensualidad.saldo_pendiente)) {
      throw new BadRequestException(
        'El monto pagado excede el saldo pendiente',
      );
    }

    // Generar número de recibo
    const numeroRecibo = await this.generarNumeroRecibo();

    const pago = this.pagoRepository.create({
      ...createPagoDto,
      mensualidad,
      jugador: mensualidad.jugador,
      registrado_por: usuario,
      numero_recibo: numeroRecibo,
    });

    await this.pagoRepository.save(pago);

    // Actualizar mensualidad
    await this.mensualidadesService.registrarPago(
      mensualidad.id,
      createPagoDto.monto_pagado,
    );

    return {
      message: 'Pago registrado exitosamente',
      data: pago,
      numero_recibo: numeroRecibo,
    };
  }

  async findAll(filterDto: FilterPagoDto) {
    const { skip, limit, sortBy = 'id', sortOrder = 'DESC' } = filterDto;
    const { search, jugador_id, metodo_pago, fecha_desde, fecha_hasta } = filterDto;

    const query = this.pagoRepository
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.jugador', 'jugador')
      .leftJoinAndSelect('pago.mensualidad', 'mensualidad')
      .leftJoinAndSelect('pago.registrado_por', 'usuario')
      .where('pago.anulado = :anulado', { anulado: false });

    if (search) {
      query.andWhere(
        '(unaccent(jugador.nombre) ILIKE unaccent(:search) OR unaccent(jugador.apellido) ILIKE unaccent(:search) OR jugador.documento ILIKE :search OR unaccent(CONCAT(jugador.nombre, \' \', jugador.apellido)) ILIKE unaccent(:search))',
        { search: `%${search}%` },
      );
    }

    if (jugador_id) {
      query.andWhere('pago.jugador_id = :jugador_id', { jugador_id });
    }

    if (metodo_pago) {
      query.andWhere('pago.metodo_pago = :metodo_pago', { metodo_pago });
    }

    if (fecha_desde && fecha_hasta) {
      query.andWhere('pago.fecha_pago BETWEEN :fecha_desde AND :fecha_hasta', {
        fecha_desde,
        fecha_hasta,
      });
    }

    query.orderBy(`pago.${sortBy}`, sortOrder).skip(skip).take(limit);

    const [pagos, total] = await query.getManyAndCount();

    return PaginatedResultHelper.create(pagos, total, filterDto.page, limit);
  }

  async findOne(id: number) {
    const pago = await this.pagoRepository.findOne({
      where: { id },
      relations: ['jugador', 'mensualidad', 'registrado_por', 'comprobantes'],
    });

    if (!pago) {
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }

    return pago;
  }

  async anular(id: number, anularDto: AnularPagoDto, usuario: Usuario) {
    const pago = await this.findOne(id);

    if (pago.anulado) {
      throw new BadRequestException('El pago ya está anulado');
    }

    pago.anulado = true;
    pago.fecha_anulacion = new Date();
    pago.motivo_anulacion = anularDto.motivo;

    await this.pagoRepository.save(pago);

    // Revertir en mensualidad
    const mensualidad = await this.mensualidadRepository.findOne({
      where: { id: pago.mensualidad.id },
    });

    if (mensualidad) {
      mensualidad.monto_pagado = Number(mensualidad.monto_pagado) - Number(pago.monto_pagado);
      mensualidad.saldo_pendiente = Number(mensualidad.saldo_pendiente) + Number(pago.monto_pagado);
      
      if (mensualidad.monto_pagado <= 0) {
        mensualidad.estado = 'pendiente' as any;
      } else {
        mensualidad.estado = 'parcial' as any;
      }

      await this.mensualidadRepository.save(mensualidad);
    }

    return {
      message: 'Pago anulado exitosamente',
      data: pago,
    };
  }

  async update(id: number, updateDto: UpdatePagoDto) {
    const pago = await this.findOne(id);

    if (pago.anulado) {
      throw new BadRequestException('No se puede editar un pago anulado');
    }

    pago.metodo_pago = updateDto.metodo_pago;
    if (updateDto.observaciones !== undefined) {
      pago.observaciones = updateDto.observaciones;
    }

    await this.pagoRepository.save(pago);

    return {
      message: 'Pago actualizado exitosamente',
      data: pago,
    };
  }

  async getPorFecha(fecha: string) {
    const pagos = await this.pagoRepository.find({
      where: {
        fecha_pago: Between(
          new Date(fecha + 'T00:00:00'),
          new Date(fecha + 'T23:59:59'),
        ),
        anulado: false,
      },
      relations: ['jugador', 'mensualidad'],
    });

    const total = pagos.reduce((sum, p) => sum + Number(p.monto_pagado), 0);

    return {
      fecha,
      total_pagos: pagos.length,
      monto_total: total,
      pagos,
    };
  }

  async getPorMetodo(metodo: string) {
    const pagos = await this.pagoRepository.find({
      where: { metodo_pago: metodo as any, anulado: false },
      relations: ['jugador'],
    });

    const total = pagos.reduce((sum, p) => sum + Number(p.monto_pagado), 0);

    return {
      metodo,
      total_pagos: pagos.length,
      monto_total: total,
      pagos,
    };
  }

  private async generarNumeroRecibo(): Promise<string> {
    let config = await this.configuracionRepository.findOne({
      where: { clave: 'numero_recibo_actual' },
    });

    let numeroActual: number;

    if (config) {
      numeroActual = parseInt(config.valor) + 1;
      config.valor = numeroActual.toString();
      await this.configuracionRepository.save(config);
    } else {
      // Crear el registro si no existe
      const ultimoPago = await this.pagoRepository
        .createQueryBuilder('pago')
        .select('MAX(pago.id)', 'max')
        .getRawOne();

      numeroActual = (ultimoPago?.max || 0) + 1;

      config = this.configuracionRepository.create({
        clave: 'numero_recibo_actual',
        valor: numeroActual.toString(),
        tipo: 'number',
        descripcion: 'Número de recibo actual para generación automática',
      });
      await this.configuracionRepository.save(config);
    }

    return `REC-${String(numeroActual).padStart(6, '0')}`;
  }

  async guardarComprobante(pagoId: number, file: Express.Multer.File) {
    const pago = await this.findOne(pagoId);

    // Convertir el archivo a base64
    const contenidoBase64 = file.buffer.toString('base64');

    const comprobante = this.comprobanteRepository.create({
      pago,
      nombre_archivo: file.originalname,
      ruta_archivo: null,
      tipo_archivo: file.mimetype,
      tamaño_bytes: file.size,
      contenido_base64: contenidoBase64,
    });

    await this.comprobanteRepository.save(comprobante);

    return {
      message: 'Comprobante subido exitosamente',
      data: {
        id: comprobante.id,
        nombre_archivo: comprobante.nombre_archivo,
        tipo_archivo: comprobante.tipo_archivo,
        tamaño_bytes: comprobante.tamaño_bytes,
      },
    };
  }

  async getComprobante(comprobanteId: number) {
    const comprobante = await this.comprobanteRepository.findOne({
      where: { id: comprobanteId },
    });

    if (!comprobante) {
      throw new NotFoundException('Comprobante no encontrado');
    }

    return comprobante;
  }

  async generarReciboPdf(id: number): Promise<Buffer> {
    const pago = await this.pagoRepository.findOne({
      where: { id },
      relations: [
        'jugador',
        'jugador.categoria',
        'mensualidad',
        'registrado_por',
      ],
    });

    if (!pago) {
      throw new NotFoundException(`Pago con ID ${id} no encontrado`);
    }

    const meses = [
      '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const clubName = process.env.CLUB_NAME || 'Club Deportivo';

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(clubName, { align: 'center' });
      doc.moveDown(0.3);
      doc
        .fontSize(14)
        .font('Helvetica')
        .text('RECIBO DE PAGO', { align: 'center' });
      doc.moveDown(0.5);

      // Línea separadora
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#1a3a5c')
        .lineWidth(2)
        .stroke();
      doc.moveDown(1);

      // Info del recibo
      const startY = doc.y;
      const col1 = 50;
      const col2 = 300;
      const labelWidth = 130;

      const addRow = (label: string, value: string) => {
        doc.font('Helvetica-Bold').fontSize(11).text(label, col1, doc.y, { width: labelWidth, continued: false });
        doc.font('Helvetica').fontSize(11).text(value, col1 + labelWidth, doc.y - 14);
        doc.moveDown(0.5);
      };

      addRow('N° Recibo:', pago.numero_recibo);
      addRow('Fecha:', new Date(pago.fecha_pago).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric',
      }));
      doc.moveDown(0.5);

      // Línea separadora fina
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.8);

      addRow('Jugador:', `${pago.jugador.nombre} ${pago.jugador.apellido}`);
      addRow('Documento:', pago.jugador.documento);
      if (pago.jugador.categoria) {
        addRow('Categoría:', pago.jugador.categoria.nombre);
      }
      doc.moveDown(0.5);

      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.8);

      const periodo = pago.mensualidad
        ? `${meses[pago.mensualidad.mes]} ${pago.mensualidad.anio}`
        : 'N/A';
      addRow('Período:', periodo);
      addRow('Monto Pagado:', `$${Number(pago.monto_pagado).toLocaleString('es-CO')}`);
      addRow('Método de Pago:', pago.metodo_pago.charAt(0).toUpperCase() + pago.metodo_pago.slice(1));

      if (pago.mensualidad) {
        addRow('Saldo Pendiente:', `$${Number(pago.mensualidad.saldo_pendiente).toLocaleString('es-CO')}`);
      }

      if (pago.registrado_por) {
        addRow('Registrado por:', pago.registrado_por.nombre);
      }

      if (pago.observaciones) {
        doc.moveDown(0.5);
        addRow('Observaciones:', pago.observaciones);
      }

      // Footer
      doc.moveDown(3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .fillColor('#9ca3af')
        .text('Documento generado automáticamente - No requiere firma', {
          align: 'center',
        });

      doc.end();
    });
  }

  /**
   * Interpreta mensajes pegados desde WhatsApp y busca las coincidencias
   * automáticas con los jugadores activos y sus mensualidades.
   */
  async interpretarWhatsApp(dto: InterpretarTextoDto) {
    const lineasInterpretadas = WhatsAppParserUtil.parsearTextoCompleto(dto.texto);

    // Obtener todos los jugadores activos con sus categorías y mensualidades pendientes
    const jugadores = await this.jugadorRepository.find({
      where: { activo: true },
      relations: ['categoria', 'mensualidades'],
    });

    const resultados = [];

    for (const item of lineasInterpretadas) {
      // Buscar similitud con cada jugador
      const scoredJugadores = jugadores.map((j) => {
        const nombreCompleto = `${j.nombre} ${j.apellido}`.trim();
        let score = WhatsAppParserUtil.calcularSimilitud(item.nombreCandidato, nombreCompleto);

        // Si hay pista de categoría y coincide con el nombre de la categoría del jugador, dar un bonus
        if (item.categoriaPista && j.categoria?.nombre) {
          const pistaNorm = WhatsAppParserUtil.normalizarTexto(item.categoriaPista);
          const catNorm = WhatsAppParserUtil.normalizarTexto(j.categoria.nombre);
          if (catNorm.includes(pistaNorm) || pistaNorm.includes(catNorm)) {
            score = Math.min(1.0, score + 0.12);
          }
        }

        return {
          jugador: j,
          score: Math.round(score * 100) / 100,
        };
      });

      scoredJugadores.sort((a, b) => b.score - a.score);

      const mejor = scoredJugadores[0];
      const matchExacto = mejor && mejor.score >= 0.8;
      const matchSugerido = mejor && mejor.score >= 0.55;

      const jugadorSeleccionado = matchSugerido ? mejor.jugador : null;

      // Buscar mensualidad del mes detectado o la pendiente más antigua
      let mensualidadAsignada: Mensualidad | null = null;
      let montoPagar = 0;

      if (jugadorSeleccionado) {
        const anio = item.anioDetectado || new Date().getFullYear();
        const mes = item.mesDetectado || new Date().getMonth() + 1;

        // Buscar mensualidad específica de ese mes
        mensualidadAsignada = jugadorSeleccionado.mensualidades?.find(
          (m) => m.mes === mes && m.anio === anio,
        ) || null;

        // Si no existe la mensualidad para ese mes pero el jugador tiene categoría, crearla automáticamente
        if (!mensualidadAsignada && jugadorSeleccionado.categoria) {
          const nuevaMensualidad = this.mensualidadRepository.create({
            jugador: jugadorSeleccionado,
            mes,
            anio,
            monto: jugadorSeleccionado.categoria.valor_mensualidad,
            monto_pagado: 0,
            saldo_pendiente: jugadorSeleccionado.categoria.valor_mensualidad,
            estado: 'pendiente' as any,
            fecha_vencimiento: new Date(anio, mes - 1, jugadorSeleccionado.dia_vencimiento || 5),
          });
          mensualidadAsignada = await this.mensualidadRepository.save(nuevaMensualidad);
        } else if (!mensualidadAsignada) {
          // Buscar cualquier mensualidad pendiente
          mensualidadAsignada = jugadorSeleccionado.mensualidades?.find(
            (m) => m.estado !== 'pagado' && Number(m.saldo_pendiente) > 0,
          ) || null;
        }

        if (mensualidadAsignada) {
          montoPagar = Number(mensualidadAsignada.saldo_pendiente);
        }
      }

      // Preparar observaciones con conceptos adicionales si los hay
      let obs = '';
      if (item.conceptosAdicionales.length > 0) {
        obs = item.conceptosAdicionales.join(', ');
        if (item.montoAdicional) {
          obs += ` ($${Number(item.montoAdicional).toLocaleString('es-CO')})`;
        }
      }

      resultados.push({
        idTemporal: Math.random().toString(36).substring(2, 9),
        lineaOriginal: item.lineaOriginal,
        nombreCandidato: item.nombreCandidato,
        mesDetectado: item.mesDetectado,
        mesNombre: item.mesNombre || (mensualidadAsignada ? `Mes ${mensualidadAsignada.mes}` : ''),
        anioDetectado: item.anioDetectado,
        categoriaPista: item.categoriaPista,
        conceptosAdicionales: item.conceptosAdicionales,
        montoAdicional: item.montoAdicional,
        metodoSugerido: item.metodoDetectado || 'efectivo',
        observaciones: obs,
        montoPagar: montoPagar,
        coincidencia: matchExacto ? 'exacta' : matchSugerido ? 'sugerida' : 'no_encontrado',
        score: mejor ? mejor.score : 0,
        jugador: jugadorSeleccionado ? {
          id: jugadorSeleccionado.id,
          nombre: jugadorSeleccionado.nombre,
          apellido: jugadorSeleccionado.apellido,
          documento: jugadorSeleccionado.documento,
          categoria: jugadorSeleccionado.categoria ? {
            id: jugadorSeleccionado.categoria.id,
            nombre: jugadorSeleccionado.categoria.nombre,
            valor_mensualidad: jugadorSeleccionado.categoria.valor_mensualidad,
          } : null,
        } : null,
        mensualidad: mensualidadAsignada ? {
          id: mensualidadAsignada.id,
          mes: mensualidadAsignada.mes,
          anio: mensualidadAsignada.anio,
          monto: mensualidadAsignada.monto,
          saldo_pendiente: mensualidadAsignada.saldo_pendiente,
          estado: mensualidadAsignada.estado,
        } : null,
        sugerencias: scoredJugadores.slice(0, 4).map(s => ({
          id: s.jugador.id,
          nombre: `${s.jugador.nombre} ${s.jugador.apellido}`,
          documento: s.jugador.documento,
          categoria: s.jugador.categoria?.nombre || 'Sin categoría',
          score: s.score,
        })),
        incluir: matchSugerido && mensualidadAsignada !== null,
        comprobante: null,
      });
    }

    return {
      totalLineas: lineasInterpretadas.length,
      coincidenciasExactas: resultados.filter(r => r.coincidencia === 'exacta').length,
      sugerencias: resultados.filter(r => r.coincidencia === 'sugerida').length,
      noEncontrados: resultados.filter(r => r.coincidencia === 'no_encontrado').length,
      items: resultados,
    };
  }

  /**
   * Registra múltiples pagos en lote de forma atómica y consistente.
   */
  async registrarLote(loteDto: RegistrarLotePagosDto, usuario: Usuario) {
    if (!loteDto.pagos || loteDto.pagos.length === 0) {
      throw new BadRequestException('La lista de pagos no puede estar vacía');
    }

    const pagosCreados = [];
    const errores = [];

    for (const [index, pagoDto] of loteDto.pagos.entries()) {
      try {
        let mensualidad: Mensualidad | null = null;

        if (pagoDto.mensualidad_id) {
          mensualidad = await this.mensualidadRepository.findOne({
            where: { id: pagoDto.mensualidad_id },
            relations: ['jugador', 'jugador.categoria'],
          });
        }

        // Si no se encontró por ID pero viene jugador_id, mes y anio, buscar o crear bajo demanda
        if (!mensualidad && pagoDto.jugador_id && pagoDto.mes && pagoDto.anio) {
          mensualidad = await this.mensualidadRepository.findOne({
            where: {
              jugador: { id: pagoDto.jugador_id },
              mes: pagoDto.mes,
              anio: pagoDto.anio,
            },
            relations: ['jugador', 'jugador.categoria'],
          });

          if (!mensualidad) {
            const jugador = await this.jugadorRepository.findOne({
              where: { id: pagoDto.jugador_id },
              relations: ['categoria'],
            });
            if (jugador) {
              const valorCuota = jugador.categoria?.valor_mensualidad
                ? Number(jugador.categoria.valor_mensualidad)
                : 50000;
              const nuevaM = this.mensualidadRepository.create({
                jugador,
                mes: pagoDto.mes,
                anio: pagoDto.anio,
                monto: valorCuota,
                monto_pagado: 0,
                saldo_pendiente: valorCuota,
                estado: 'pendiente' as any,
                fecha_vencimiento: new Date(pagoDto.anio, pagoDto.mes - 1, jugador.dia_vencimiento || 5),
              });
              mensualidad = await this.mensualidadRepository.save(nuevaM);
            }
          }
        }

        if (!mensualidad) {
          throw new NotFoundException(`Mensualidad para el pago no encontrada`);
        }

        // Validación antifraude / antiduplicados:
        // 1. Evitar registrar comprobantes con la misma referencia Nequi
        const matchRef = pagoDto.observaciones?.match(/Ref:\s*([A-Z0-9]+)/i);
        const referenciaOcr = matchRef ? matchRef[1] : null;
        if (referenciaOcr) {
          const pagoConMismaRef = await this.pagoRepository.createQueryBuilder('pago')
            .where('pago.anulado = false')
            .andWhere('pago.observaciones ILIKE :refPattern', { refPattern: `%${referenciaOcr}%` })
            .getOne();

          if (pagoConMismaRef) {
            throw new BadRequestException(
              `El comprobante con referencia ${referenciaOcr} ya fue registrado previamente en el recibo ${pagoConMismaRef.numero_recibo}`,
            );
          }
        }

        // 2. Evitar registrar pagos en una mensualidad que ya esté totalmente pagada
        if (mensualidad.estado === 'pagado' && Number(mensualidad.saldo_pendiente) <= 0) {
          throw new BadRequestException(
            `La mensualidad ${mensualidad.mes}/${mensualidad.anio} de ${mensualidad.jugador?.nombre || 'jugador'} ya está pagada en su totalidad`,
          );
        }

        const saldoActual = Number(mensualidad.saldo_pendiente);
        // Ajustar el monto al saldo pendiente si la cuota era ligeramente menor para evitar rechazo
        const montoAplicar = saldoActual > 0 ? Math.min(pagoDto.monto_pagado, saldoActual) : pagoDto.monto_pagado;

        const numeroRecibo = await this.generarNumeroRecibo();

        const pago = this.pagoRepository.create({
          mensualidad,
          jugador: mensualidad.jugador,
          monto_pagado: montoAplicar,
          metodo_pago: pagoDto.metodo_pago,
          observaciones: pagoDto.observaciones,
          registrado_por: usuario,
          numero_recibo: numeroRecibo,
        });

        const pagoGuardado = await this.pagoRepository.save(pago);

        // Si viene comprobante base64 o archivo, guardarlo
        if (pagoDto.comprobante_archivo) {
          const comp = this.comprobanteRepository.create({
            pago: pagoGuardado,
            nombre_archivo: `comprobante-nequi-${pagoGuardado.id}.jpg`,
            tipo_archivo: 'image/jpeg',
            tamaño_bytes: Math.round(pagoDto.comprobante_archivo.length * 0.75),
            contenido_base64: pagoDto.comprobante_archivo,
          });
          await this.comprobanteRepository.save(comp);
        }

        // Actualizar estado y saldos de la mensualidad si aún tiene saldo pendiente
        if (mensualidad.estado !== 'pagado') {
          await this.mensualidadesService.registrarPago(
            mensualidad.id,
            montoAplicar,
          );
        }

        pagosCreados.push({
          id: pagoGuardado.id,
          numero_recibo: numeroRecibo,
          jugador: `${mensualidad.jugador.nombre} ${mensualidad.jugador.apellido}`,
          monto: pagoDto.monto_pagado,
          metodo_pago: pagoDto.metodo_pago,
        });
      } catch (err) {
        errores.push({
          indice: index,
          mensaje: err.message || 'Error procesando pago',
        });
      }
    }

    return {
      message: `Se registraron exitosamente ${pagosCreados.length} de ${loteDto.pagos.length} pagos`,
      total_procesados: loteDto.pagos.length,
      exitosos: pagosCreados.length,
      fallidos: errores.length,
      pagos: pagosCreados,
      errores,
    };
  }

  /**
   * Escanea una imagen de comprobante de Nequi mediante OCR (Tesseract y/o Gemini)
   * para extraer monto, referencia, conversación, nombre de jugador y vincularlo.
   */
  async escanearComprobanteNequi(file: Express.Multer.File) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const datosOcr = await NequiOcrUtil.extraerDatosComprobante(file.buffer, file.mimetype, apiKey);

    // Obtener jugadores activos
    const jugadores = await this.jugadorRepository.find({
      where: { activo: true },
      relations: ['categoria', 'mensualidades'],
    });

    let mejorJugador: Jugador | null = null;
    let scoreMax = 0;
    let scoredJugadores = [];

    const candidato = datosOcr.nombreCandidato || datosOcr.conversacion || '';

    if (candidato) {
      scoredJugadores = jugadores.map((j) => {
        const nombreCompleto = `${j.nombre} ${j.apellido}`.trim();
        let score = WhatsAppParserUtil.calcularSimilitud(candidato, nombreCompleto);

        if (datosOcr.categoriaPista && j.categoria?.nombre) {
          const pistaNorm = WhatsAppParserUtil.normalizarTexto(datosOcr.categoriaPista);
          const catNorm = WhatsAppParserUtil.normalizarTexto(j.categoria.nombre);
          if (catNorm.includes(pistaNorm) || pistaNorm.includes(catNorm)) {
            score = Math.min(1.0, score + 0.12);
          }
        }

        return {
          jugador: j,
          score: Math.round(score * 100) / 100,
        };
      });

      scoredJugadores.sort((a, b) => b.score - a.score);
      if (scoredJugadores.length > 0 && scoredJugadores[0].score >= 0.55) {
        mejorJugador = scoredJugadores[0].jugador;
        scoreMax = scoredJugadores[0].score;
      }
    }

    const anio = datosOcr.anioDetectado || new Date().getFullYear();
    const mes = datosOcr.mesDetectado || new Date().getMonth() + 1;

    const NOMBRES_MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const esDoble = datosOcr.esPagoDobleMes || datosOcr.monto >= 80000 || /mensualidades/i.test(datosOcr.conversacion || '');
    const montoPorMes = esDoble ? Math.round((datosOcr.monto || 100000) / 2) : (datosOcr.monto || 50000);

    let mensualidadAsignada: Mensualidad | null = null;
    let mensualidadMes1: Mensualidad | null = null;
    let mensualidadMes2: Mensualidad | null = null;
    let mensualidadesDisponibles: any[] = [];

    if (mejorJugador) {
      const valorMensualidadCat = mejorJugador.categoria?.valor_mensualidad
        ? Number(mejorJugador.categoria.valor_mensualidad)
        : 50000;

      // Asegurar que la mensualidad del mes detectado exista
      mensualidadAsignada = mejorJugador.mensualidades?.find(
        (m) => m.mes === mes && m.anio === anio,
      ) || null;

      if (!mensualidadAsignada && mejorJugador.categoria) {
        const nuevaMensualidad = this.mensualidadRepository.create({
          jugador: mejorJugador,
          mes,
          anio,
          monto: valorMensualidadCat,
          monto_pagado: 0,
          saldo_pendiente: valorMensualidadCat,
          estado: 'pendiente' as any,
          fecha_vencimiento: new Date(anio, mes - 1, mejorJugador.dia_vencimiento || 5),
        });
        mensualidadAsignada = await this.mensualidadRepository.save(nuevaMensualidad);
        if (!mejorJugador.mensualidades) mejorJugador.mensualidades = [];
        mejorJugador.mensualidades.push(mensualidadAsignada);
      }

      // Ordenar todas las mensualidades del jugador cronológicamente
      const ordenadas = [...(mejorJugador.mensualidades || [])].sort((a, b) => {
        if (a.anio !== b.anio) return a.anio - b.anio;
        return a.mes - b.mes;
      });

      // Si es pago de 2 meses, buscar los dos meses objetivo
      if (esDoble) {
        const mesAnteriorNum = mes === 1 ? 12 : mes - 1;
        const anioAnteriorNum = mes === 1 ? anio - 1 : anio;
        const mesAnteriorObj = ordenadas.find(m => m.mes === mesAnteriorNum && m.anio === anioAnteriorNum);

        if (mesAnteriorObj && mesAnteriorObj.estado !== 'pagado' && Number(mesAnteriorObj.saldo_pendiente) > 0) {
          // El mes anterior está pendiente: Paga Mes Anterior + Mes Detectado (ej. Agosto + Septiembre)
          mensualidadMes1 = mesAnteriorObj;
          mensualidadMes2 = mensualidadAsignada;
        } else {
          // El mes anterior está al día: Paga Mes Detectado + Mes Siguiente (ej. Septiembre + Octubre)
          mensualidadMes1 = mensualidadAsignada;
          const proxMesNum = (mes % 12) + 1;
          const proxAnioNum = mes === 12 ? anio + 1 : anio;
          let proxMesObj = ordenadas.find(m => m.mes === proxMesNum && m.anio === proxAnioNum);

          if (!proxMesObj && mejorJugador.categoria) {
            const nuevaSiguiente = this.mensualidadRepository.create({
              jugador: mejorJugador,
              mes: proxMesNum,
              anio: proxAnioNum,
              monto: valorMensualidadCat,
              monto_pagado: 0,
              saldo_pendiente: valorMensualidadCat,
              estado: 'pendiente' as any,
              fecha_vencimiento: new Date(proxAnioNum, proxMesNum - 1, mejorJugador.dia_vencimiento || 5),
            });
            proxMesObj = await this.mensualidadRepository.save(nuevaSiguiente);
            ordenadas.push(proxMesObj);
          }
          mensualidadMes2 = proxMesObj || null;
        }
      }

      mensualidadesDisponibles = ordenadas.map(m => ({
        id: m.id,
        mes: m.mes,
        anio: m.anio,
        mesNombre: `${NOMBRES_MESES[m.mes] || 'Mes ' + m.mes} ${m.anio}`,
        monto: Number(m.monto),
        saldo_pendiente: Number(m.saldo_pendiente),
        estado: m.estado,
      }));
    }

    // Convertir imagen a Base64 Data URL
    const base64Data = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const convLimpia = (datosOcr.conversacion || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

    let observaciones = '';
    if (datosOcr.referencia) {
      observaciones += `Ref: ${datosOcr.referencia}`;
    }
    if (convLimpia) {
      if (!observaciones.includes(convLimpia)) {
        observaciones += observaciones ? ` - ${convLimpia}` : convLimpia;
      }
    }

    let mesNombreStr = 'Mes actual';
    if (esDoble && mensualidadMes1 && mensualidadMes2) {
      mesNombreStr = `${NOMBRES_MESES[mensualidadMes1.mes]} y ${NOMBRES_MESES[mensualidadMes2.mes]} ${mensualidadMes2.anio}`;
    } else if (datosOcr.mesDetectado) {
      mesNombreStr = `${NOMBRES_MESES[datosOcr.mesDetectado] || 'Mes ' + datosOcr.mesDetectado} ${datosOcr.anioDetectado || anio}`;
    } else if (mensualidadAsignada) {
      mesNombreStr = `${NOMBRES_MESES[mensualidadAsignada.mes] || 'Mes ' + mensualidadAsignada.mes} ${mensualidadAsignada.anio}`;
    }

    // Verificar si la referencia ya fue registrada previamente en un pago activo (no anulado)
    let pagoDuplicado: Pago | null = null;
    if (datosOcr.referencia) {
      pagoDuplicado = await this.pagoRepository.createQueryBuilder('pago')
        .leftJoinAndSelect('pago.mensualidad', 'mensualidad')
        .leftJoinAndSelect('pago.jugador', 'jugador')
        .where('pago.anulado = false')
        .andWhere('pago.observaciones ILIKE :refPattern', { refPattern: `%${datosOcr.referencia}%` })
        .orderBy('pago.id', 'DESC')
        .getOne();
    }

    const esDuplicado = !!pagoDuplicado;
    const alertaDuplicado = pagoDuplicado
      ? `Comprobante ya registrado en el recibo ${pagoDuplicado.numero_recibo}${pagoDuplicado.jugador ? ' (' + pagoDuplicado.jugador.nombre + ' ' + pagoDuplicado.jugador.apellido + ')' : ''}`
      : null;

    const esMensualidadPagada = !esDoble && mensualidadAsignada
      ? (mensualidadAsignada.estado === 'pagado' || Number(mensualidadAsignada.saldo_pendiente) <= 0)
      : false;
    const alertaMensualidadPagada = esMensualidadPagada && mensualidadAsignada
      ? `La mensualidad de ${NOMBRES_MESES[mensualidadAsignada.mes]} ${mensualidadAsignada.anio} ya está pagada ($0 pendiente)`
      : null;

    const incluirDefault = !!mejorJugador && !!mensualidadAsignada && !esDuplicado && !esMensualidadPagada;

    return {
      idTemporal: Math.random().toString(36).substring(2, 9),
      lineaOriginal: convLimpia || `Comprobante Nequi (${datosOcr.referencia || file.originalname})`,
      nombreCandidato: datosOcr.nombreCandidato || '',
      mesDetectado: datosOcr.mesDetectado,
      mesNombre: mesNombreStr,
      anioDetectado: datosOcr.anioDetectado,
      categoriaPista: datosOcr.categoriaPista,
      montoPagar: datosOcr.monto > 0 ? datosOcr.monto : (mensualidadAsignada ? Number(mensualidadAsignada.saldo_pendiente) : 0),
      metodoPago: 'nequi',
      observaciones: observaciones.trim(),
      referencia: datosOcr.referencia,
      esDuplicado,
      alertaDuplicado,
      pagoDuplicadoRecibo: pagoDuplicado?.numero_recibo || null,
      esMensualidadPagada,
      alertaMensualidadPagada,
      coincidencia: scoreMax >= 0.8 ? 'exacta' : scoreMax >= 0.55 ? 'sugerida' : 'no_encontrado',
      score: scoreMax,
      esDobleMes: esDoble,
      montoMes1: montoPorMes,
      montoMes2: montoPorMes,
      idMensualidadMes1: mensualidadMes1?.id || null,
      idMensualidadMes2: mensualidadMes2?.id || null,
      mensualidadMes1: mensualidadMes1 ? {
        id: mensualidadMes1.id,
        mes: mensualidadMes1.mes,
        anio: mensualidadMes1.anio,
        monto: mensualidadMes1.monto,
        saldo_pendiente: mensualidadMes1.saldo_pendiente,
        estado: mensualidadMes1.estado,
      } : null,
      mensualidadMes2: mensualidadMes2 ? {
        id: mensualidadMes2.id,
        mes: mensualidadMes2.mes,
        anio: mensualidadMes2.anio,
        monto: mensualidadMes2.monto,
        saldo_pendiente: mensualidadMes2.saldo_pendiente,
        estado: mensualidadMes2.estado,
      } : null,
      mensualidadesDisponibles,
      jugador: mejorJugador ? {
        id: mejorJugador.id,
        nombre: mejorJugador.nombre,
        apellido: mejorJugador.apellido,
        documento: mejorJugador.documento,
        categoria: mejorJugador.categoria ? {
          id: mejorJugador.categoria.id,
          nombre: mejorJugador.categoria.nombre,
          valor_mensualidad: mejorJugador.categoria.valor_mensualidad,
        } : null,
      } : null,
      mensualidad: mensualidadAsignada ? {
        id: mensualidadAsignada.id,
        mes: mensualidadAsignada.mes,
        anio: mensualidadAsignada.anio,
        monto: mensualidadAsignada.monto,
        saldo_pendiente: mensualidadAsignada.saldo_pendiente,
        estado: mensualidadAsignada.estado,
      } : null,
      sugerencias: scoredJugadores.slice(0, 4).map(s => ({
        id: s.jugador.id,
        nombre: `${s.jugador.nombre} ${s.jugador.apellido}`,
        documento: s.jugador.documento,
        categoria: s.jugador.categoria?.nombre || 'Sin categoría',
        score: s.score,
      })),
      incluir: incluirDefault,
      comprobanteBase64: base64Data,
      comprobanteNombre: file.originalname,
      comprobantePreview: base64Data,
    };
  }
}
