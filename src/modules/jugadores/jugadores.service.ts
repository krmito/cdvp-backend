import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { Jugador } from '@entities/jugador.entity';
import { Categoria } from '@entities/categoria.entity';
import { CreateJugadorDto } from './dto/create-jugador.dto';
import { UpdateJugadorDto } from './dto/update-jugador.dto';
import { FilterJugadorDto } from './dto/filter-jugador.dto';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';

@Injectable()
export class JugadoresService {
  constructor(
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
    @InjectRepository(Categoria)
    private readonly categoriaRepository: Repository<Categoria>,
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
        '(jugador.nombre ILIKE :search OR jugador.documento ILIKE :search)',
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
}
