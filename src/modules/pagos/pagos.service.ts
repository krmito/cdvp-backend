import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Pago } from '@entities/pago.entity';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Usuario } from '@entities/usuario.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { Comprobante } from '@entities/comprobante.entity';
import { CreatePagoDto, FilterPagoDto, AnularPagoDto } from './dto/pagos.dto';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';
import { MensualidadesService } from '../mensualidades/mensualidades.service';

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
    private readonly mensualidadesService: MensualidadesService,
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
    const { jugador_id, metodo_pago, fecha_desde, fecha_hasta } = filterDto;

    const query = this.pagoRepository
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.jugador', 'jugador')
      .leftJoinAndSelect('pago.mensualidad', 'mensualidad')
      .leftJoinAndSelect('pago.registrado_por', 'usuario')
      .where('pago.anulado = :anulado', { anulado: false });

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
    const config = await this.configuracionRepository.findOne({
      where: { clave: 'numero_recibo_actual' },
    });

    let numeroActual = config ? parseInt(config.valor) : 1;
    const nuevoNumero = numeroActual + 1;

    if (config) {
      config.valor = nuevoNumero.toString();
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
}
