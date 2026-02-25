import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { Jugador } from '@entities/jugador.entity';
import { Categoria } from '@entities/categoria.entity';
import { CreateJugadorDto } from './dto/create-jugador.dto';
import { UpdateJugadorDto } from './dto/update-jugador.dto';
import { FilterJugadorDto } from './dto/filter-jugador.dto';
import { BulkImportRowDto } from './dto/bulk-import-jugador.dto';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';
import { MensualidadesService } from '../mensualidades/mensualidades.service';

@Injectable()
export class JugadoresService {
  private readonly logger = new Logger(JugadoresService.name);

  constructor(
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
    private readonly dataSource: DataSource,
    private readonly mensualidadesService: MensualidadesService,
  ) {}

  async create(createJugadorDto: CreateJugadorDto) {
    // Verificar si el documento ya existe
    const existingJugador = await this.jugadorRepository.findOne({
      where: { documento: createJugadorDto.documento },
    });

    if (existingJugador) {
      throw new ConflictException('El documento ya está registrado');
    }

    // Verificar que la categoría exista
    const categoria = await this.categoriaRepository.findOne({
      where: { id: createJugadorDto.categoria_id },
    });

    if (!categoria) {
      throw new NotFoundException('Categoría no encontrada');
    }

    const jugador = this.jugadorRepository.create({
      ...createJugadorDto,
      categoria,
    });

    await this.jugadorRepository.save(jugador);

    // Fire-and-forget: auto-generar mensualidad si ya se generaron las del mes
    this.mensualidadesService
      .generarMensualidadParaNuevoJugador(jugador)
      .catch((err) => this.logger.error(`Error auto-generando mensualidad para jugador ${jugador.id}: ${err.message}`));

    return {
      message: 'Jugador registrado exitosamente',
      data: jugador,
    };
  }

  async findAll(filterDto: FilterJugadorDto) {
    const { skip, limit, sortBy = 'id', sortOrder = 'DESC' } = filterDto;
    const { search, categoria_id, activo, posicion } = filterDto;

    const query = this.jugadorRepository
      .createQueryBuilder('jugador')
      .leftJoinAndSelect('jugador.categoria', 'categoria')
      .leftJoinAndSelect('jugador.mensualidades', 'mensualidades')
      .leftJoinAndSelect('jugador.pagos', 'pagos');

    // Filtros
    if (search) {
      query.andWhere(
        '(jugador.nombre ILIKE :search OR jugador.apellido ILIKE :search OR jugador.documento ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (categoria_id) {
      query.andWhere('jugador.categoria_id = :categoria_id', { categoria_id });
    }

    if (activo !== undefined && activo !== null) {
      const filterActivo = activo === 'true' ? true : false;
      console.log('Valor recibido para activo:', activo);
      query.andWhere('jugador.activo = :activo', { activo: filterActivo });
      console.log('Filtro activo aplicado en backend:', filterActivo);
    }

    if (posicion) {
      query.andWhere('jugador.posicion ILIKE :posicion', {
        posicion: `%${posicion}%`,
      });
    }

    // Ordenamiento
    query.orderBy(`jugador.${sortBy}`, sortOrder);

    // Paginación
    query.skip(skip).take(limit);

    const [jugadores, total] = await query.getManyAndCount();

    return PaginatedResultHelper.create(
      jugadores,
      total,
      filterDto.page,
      limit,
    );
  }

  async findOne(id: number) {
    const jugador = await this.jugadorRepository.findOne({
      where: { id },
      relations: ['categoria', 'mensualidades', 'pagos'],
    });

    if (!jugador) {
      throw new NotFoundException(`Jugador con ID ${id} no encontrado`);
    }

    return jugador;
  }

  async findByDocumento(documento: string) {
    const jugador = await this.jugadorRepository.findOne({
      where: { documento },
      relations: ['categoria'],
    });

    if (!jugador) {
      throw new NotFoundException(`Jugador con documento ${documento} no encontrado`);
    }

    return jugador;
  }

  async update(id: number, updateJugadorDto: UpdateJugadorDto) {
    const jugador = await this.findOne(id);

    // Si se actualiza el documento, verificar que no exista
    if (updateJugadorDto.documento && updateJugadorDto.documento !== jugador.documento) {
      const existingJugador = await this.jugadorRepository.findOne({
        where: { documento: updateJugadorDto.documento },
      });

      if (existingJugador) {
        throw new ConflictException('El documento ya está registrado');
      }
    }

    // Si se actualiza la categoría, verificar que exista
    if (updateJugadorDto.categoria_id) {
      const categoria = await this.categoriaRepository.findOne({
        where: { id: updateJugadorDto.categoria_id },
      });

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada');
      }

      jugador.categoria = categoria;
    }

    Object.assign(jugador, updateJugadorDto);
    await this.jugadorRepository.save(jugador);

    return {
      message: 'Jugador actualizado exitosamente',
      data: jugador,
    };
  }

  async remove(id: number) {
    const jugador = await this.findOne(id);

    // Verificar si tiene pagos o mensualidades
    if (jugador.pagos && jugador.pagos.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar el jugador porque tiene pagos registrados',
      );
    }

    if (jugador.mensualidades && jugador.mensualidades.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar el jugador porque tiene mensualidades asociadas',
      );
    }

    await this.jugadorRepository.remove(jugador);

    return {
      message: 'Jugador eliminado exitosamente',
    };
  }

  async toggleActive(id: number) {
    const jugador = await this.findOne(id);
    jugador.activo = !jugador.activo;
    await this.jugadorRepository.save(jugador);

    return {
      message: `Jugador ${jugador.activo ? 'activado' : 'desactivado'} exitosamente`,
      data: jugador,
    };
  }

  async getHistorialPagos(id: number) {
    const jugador = await this.jugadorRepository.findOne({
      where: { id },
      relations: ['pagos', 'pagos.mensualidad', 'mensualidades'],
      order: {
        pagos: {
          fecha_pago: 'DESC',
        },
      },
    });

    if (!jugador) {
      throw new NotFoundException(`Jugador con ID ${id} no encontrado`);
    }

    return {
      jugador: {
        id: jugador.id,
        nombre: jugador.nombre,
        documento: jugador.documento,
      },
      historial_pagos: jugador.pagos,
      mensualidades: jugador.mensualidades,
    };
  }

  async subirFoto(id: number, file: Express.Multer.File) {
    const jugador = await this.jugadorRepository.findOne({
      where: { id },
    });

    if (!jugador) {
      // Eliminar archivo subido si el jugador no existe
      fs.unlinkSync(file.path);
      throw new NotFoundException(`Jugador con ID ${id} no encontrado`);
    }

    // Eliminar foto anterior si existe
    if (jugador.foto_url) {
      const oldPath = path.join(process.cwd(), jugador.foto_url.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Guardar nueva ruta
    jugador.foto_url = `/uploads/jugadores/${file.filename}`;
    await this.jugadorRepository.save(jugador);

    return {
      message: 'Foto actualizada exitosamente',
      foto_url: jugador.foto_url,
    };
  }

  async getStats() {
    const total = await this.jugadorRepository.count();
    const activos = await this.jugadorRepository.count({
      where: { activo: true },
    });
    const inactivos = total - activos;

    const porCategoria = await this.jugadorRepository
      .createQueryBuilder('jugador')
      .select('categoria.nombre', 'categoria')
      .addSelect('COUNT(jugador.id)', 'total')
      .innerJoin('jugador.categoria', 'categoria')
      .groupBy('categoria.nombre')
      .getRawMany();

    return {
      total,
      activos,
      inactivos,
      por_categoria: porCategoria,
    };
  }

  async bulkImport(jugadores: BulkImportRowDto[]) {
    // Pre-cargar categorias activas
    const categoriasActivas = await this.categoriaRepository.find({
      where: { activo: true },
    });
    const categoriaMap = new Map<string, Categoria>();
    for (const cat of categoriasActivas) {
      categoriaMap.set(cat.nombre.toLowerCase().trim(), cat);
    }

    // Pre-cargar documentos existentes
    const existingDocs = await this.jugadorRepository
      .createQueryBuilder('j')
      .select('j.documento')
      .getMany();
    const documentosExistentes = new Set(
      existingDocs.map((j) => j.documento.trim()),
    );

    // Detectar duplicados dentro del batch
    const documentosBatch = new Set<string>();

    const errores: {
      fila: number;
      documento: string;
      nombre: string;
      error: string;
    }[] = [];
    const jugadoresValidos: Jugador[] = [];

    for (let i = 0; i < jugadores.length; i++) {
      const row = jugadores[i];
      const fila = i + 2; // fila 1 = headers, fila 2 = primer dato
      const docTrimmed = String(row.documento).trim();
      const nombreCompleto = `${row.nombre || ''} ${row.apellido || ''}`.trim();

      // Validar campos requeridos
      if (!row.nombre?.trim()) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: 'El nombre es obligatorio',
        });
        continue;
      }
      if (!row.apellido?.trim()) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: 'El apellido es obligatorio',
        });
        continue;
      }
      if (!docTrimmed) {
        errores.push({
          fila,
          documento: '',
          nombre: nombreCompleto,
          error: 'El documento es obligatorio',
        });
        continue;
      }
      if (!row.telefono?.trim()) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: 'El telefono es obligatorio',
        });
        continue;
      }
      if (!row.categoria?.trim()) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: 'La categoria es obligatoria',
        });
        continue;
      }

      // Validar documento unico en DB
      if (documentosExistentes.has(docTrimmed)) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: 'El documento ya existe en la base de datos',
        });
        continue;
      }

      // Validar documento unico en batch
      if (documentosBatch.has(docTrimmed)) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: 'Documento duplicado dentro del archivo',
        });
        continue;
      }

      // Validar categoria
      const categoriaKey = row.categoria.toLowerCase().trim();
      const categoria = categoriaMap.get(categoriaKey);
      if (!categoria) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: `Categoria "${row.categoria}" no encontrada. Categorias disponibles: ${categoriasActivas.map((c) => c.nombre).join(', ')}`,
        });
        continue;
      }

      // Parsear fecha
      const fechaParsed = this.parseFecha(row.fecha_nacimiento);
      if (!fechaParsed) {
        errores.push({
          fila,
          documento: docTrimmed,
          nombre: nombreCompleto,
          error: `Fecha de nacimiento invalida: "${row.fecha_nacimiento}". Use DD/MM/AAAA o AAAA-MM-DD`,
        });
        continue;
      }

      // Crear entidad
      const jugador = this.jugadorRepository.create({
        nombre: row.nombre.trim(),
        apellido: row.apellido.trim(),
        documento: docTrimmed,
        fecha_nacimiento: fechaParsed,
        telefono: String(row.telefono).trim(),
        categoria,
        tipo_documento: row.tipo_documento?.trim() || 'CC',
        email: row.email?.trim() || null,
        direccion: row.direccion?.trim() || null,
        telefono_acudiente: row.telefono_acudiente?.trim() || null,
        posicion: row.posicion?.trim() || null,
        activo: true,
      });

      jugadoresValidos.push(jugador);
      documentosBatch.add(docTrimmed);
    }

    // Guardar en transaccion
    let exitosos = 0;
    if (jugadoresValidos.length > 0) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        for (const jugador of jugadoresValidos) {
          await queryRunner.manager.save(jugador);
          exitosos++;
        }
        await queryRunner.commitTransaction();
      } catch (error) {
        await queryRunner.rollbackTransaction();
        exitosos = 0;
        errores.push({
          fila: 0,
          documento: '',
          nombre: '',
          error: `Error al guardar en base de datos: ${error.message}`,
        });
      } finally {
        await queryRunner.release();
      }
    }

    // Fire-and-forget: generar mensualidades para los jugadores importados si ya se generaron las del mes
    if (exitosos > 0) {
      this.mensualidadesService
        .generarMensualidades({})
        .catch((err) => this.logger.error(`Error auto-generando mensualidades post-import: ${err.message}`));
    }

    return {
      message:
        exitosos > 0
          ? `Se importaron ${exitosos} jugadores exitosamente`
          : 'No se importo ningun jugador',
      total_procesados: jugadores.length,
      exitosos,
      fallidos: jugadores.length - exitosos,
      errores,
    };
  }

  async reenviarNotificaciones(id: number) {
    return this.mensualidadesService.reenviarNotificaciones(id);
  }

  private parseFecha(valor: string): Date | null {
    if (!valor) return null;

    const valorStr = String(valor).trim();

    // Serial de Excel (numero)
    if (/^\d+$/.test(valorStr) && Number(valorStr) > 10000) {
      const excelEpoch = new Date(1899, 11, 30);
      const days = Number(valorStr);
      const fecha = new Date(excelEpoch.getTime() + days * 86400000);
      if (!isNaN(fecha.getTime())) return fecha;
    }

    // DD/MM/AAAA o DD-MM-AAAA
    const matchDMY = valorStr.match(
      /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,
    );
    if (matchDMY) {
      const [, dia, mes, anio] = matchDMY;
      const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
      if (!isNaN(fecha.getTime())) return fecha;
    }

    // AAAA-MM-DD o AAAA/MM/DD
    const matchYMD = valorStr.match(
      /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,
    );
    if (matchYMD) {
      const [, anio, mes, dia] = matchYMD;
      const fecha = new Date(Number(anio), Number(mes) - 1, Number(dia));
      if (!isNaN(fecha.getTime())) return fecha;
    }

    // ISO string
    const fechaISO = new Date(valorStr);
    if (!isNaN(fechaISO.getTime())) return fechaISO;

    return null;
  }

  async generatePlantilla(): Promise<Buffer> {
    // Cargar categorias activas
    const categorias = await this.categoriaRepository.find({
      where: { activo: true },
      order: { nombre: 'ASC' },
    });

    const wb = XLSX.utils.book_new();

    // Hoja 1: Jugadores (datos con ejemplo)
    const headers = [
      'nombre*',
      'apellido*',
      'tipo_documento',
      'documento*',
      'fecha_nacimiento*',
      'telefono*',
      'telefono_acudiente',
      'email',
      'direccion',
      'categoria*',
      'posicion',
    ];

    const ejemplo = [
      'Juan',
      'Perez Garcia',
      'TI',
      '1234567890',
      '20/05/2015',
      '3001234567',
      '3109876543',
      'juan@email.com',
      'Calle 10 #20-30',
      categorias.length > 0 ? categorias[0].nombre : 'Sub-13',
      'Delantero',
    ];

    const wsData = [headers, ejemplo];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 15 },  // nombre
      { wch: 20 },  // apellido
      { wch: 16 },  // tipo_documento
      { wch: 15 },  // documento
      { wch: 18 },  // fecha_nacimiento
      { wch: 15 },  // telefono
      { wch: 18 },  // telefono_acudiente
      { wch: 25 },  // email
      { wch: 25 },  // direccion
      { wch: 15 },  // categoria
      { wch: 15 },  // posicion
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');

    // Hoja 2: Instrucciones
    const instrucciones = [
      ['INSTRUCCIONES PARA IMPORTAR JUGADORES'],
      [''],
      ['Campos obligatorios (marcados con *):'],
      ['nombre*', 'Nombre del jugador'],
      ['apellido*', 'Apellido(s) del jugador'],
      ['documento*', 'Numero de documento unico (no repetible)'],
      ['fecha_nacimiento*', 'Formato DD/MM/AAAA o AAAA-MM-DD'],
      ['telefono*', 'Numero de telefono'],
      ['categoria*', 'Nombre exacto de una categoria activa (ver lista abajo)'],
      [''],
      ['Campos opcionales:'],
      ['tipo_documento', 'Tipo de documento (CC, TI, CE, RC, PA). Por defecto: CC'],
      ['telefono_acudiente', 'Telefono del acudiente'],
      ['email', 'Correo electronico'],
      ['direccion', 'Direccion de residencia'],
      ['posicion', 'Posicion en el campo (Delantero, Mediocampista, etc)'],
      [''],
      ['CATEGORIAS DISPONIBLES:'],
    ];

    for (const cat of categorias) {
      instrucciones.push([
        cat.nombre,
        `Mensualidad: $${cat.valor_mensualidad}${cat.edad_minima && cat.edad_maxima ? ` | Edades: ${cat.edad_minima}-${cat.edad_maxima}` : ''}`,
      ]);
    }

    instrucciones.push(['']);
    instrucciones.push(['NOTAS:']);
    instrucciones.push([
      '- Maximo 500 jugadores por importacion',
    ]);
    instrucciones.push([
      '- Los documentos duplicados seran rechazados',
    ]);
    instrucciones.push([
      '- La fila de ejemplo en la hoja "Jugadores" debe eliminarse antes de importar',
    ]);

    const wsInst = XLSX.utils.aoa_to_sheet(instrucciones);
    wsInst['!cols'] = [{ wch: 25 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
