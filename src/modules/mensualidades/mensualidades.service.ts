import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Mensualidad, EstadoMensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { GenerarMensualidadesDto, UpdateMensualidadDto } from './dto/generar-mensualidades.dto';
import { FilterMensualidadDto } from './dto/filter-mensualidad.dto';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';

@Injectable()
export class MensualidadesService {
  constructor(
    @InjectRepository(Mensualidad)
    private readonly mensualidadRepository: Repository<Mensualidad>,
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
  ) {}

  async generarMensualidades(dto: GenerarMensualidadesDto) {
    const hoy = new Date();
    const mes = dto.mes || hoy.getMonth() + 1;
    const anio = dto.anio || hoy.getFullYear();

    // Obtener todos los jugadores activos
    const jugadores = await this.jugadorRepository.find({
      where: { activo: true },
      relations: ['categoria'],
    });

    if (jugadores.length === 0) {
      throw new BadRequestException('No hay jugadores activos para generar mensualidades');
    }

    // Obtener IDs de jugadores que ya tienen mensualidad para este período
    const mensualidadesExistentes = await this.mensualidadRepository.find({
      where: { mes, anio },
      relations: ['jugador'],
    });

    const jugadoresConMensualidad = new Set(
      mensualidadesExistentes.map((m) => m.jugador.id),
    );

    // Filtrar jugadores que NO tienen mensualidad para este período
    const jugadoresSinMensualidad = jugadores.filter(
      (j) => !jugadoresConMensualidad.has(j.id),
    );

    if (jugadoresSinMensualidad.length === 0) {
      return {
        message: `Todos los jugadores activos ya tienen mensualidad para ${mes}/${anio}`,
        generadas: 0,
        existentes: mensualidadesExistentes.length,
        mes,
        anio,
      };
    }

    const mensualidadesCreadas = [];

    // Calcular fecha de vencimiento: personalizada, o 30 días desde hoy
    let fechaVencimiento: Date;
    if (dto.fecha_vencimiento) {
      // Usar mediodía UTC para evitar problemas de timezone con columnas DATE
      fechaVencimiento = new Date(dto.fecha_vencimiento + 'T12:00:00.000Z');
    } else {
      // Por defecto: 30 días desde hoy (mediodía UTC)
      const hoy = new Date();
      fechaVencimiento = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30, 12, 0, 0));
    }

    for (const jugador of jugadoresSinMensualidad) {
      const mensualidad = this.mensualidadRepository.create({
        jugador,
        mes,
        anio,
        monto: jugador.categoria.valor_mensualidad,
        saldo_pendiente: jugador.categoria.valor_mensualidad,
        monto_pagado: 0,
        fecha_vencimiento: fechaVencimiento,
        estado: EstadoMensualidad.PENDIENTE,
      });

      const saved = await this.mensualidadRepository.save(mensualidad);
      mensualidadesCreadas.push(saved);
    }

    return {
      message: `Se generaron ${mensualidadesCreadas.length} mensualidades para ${mes}/${anio}`,
      generadas: mensualidadesCreadas.length,
      existentes: mensualidadesExistentes.length,
      mes,
      anio,
    };
  }

  async findAll(filterDto: FilterMensualidadDto) {
    const { skip, limit, sortBy = 'id', sortOrder = 'DESC' } = filterDto;
    const { jugador_id, mes, anio, estado } = filterDto;

    const query = this.mensualidadRepository
      .createQueryBuilder('mensualidad')
      .leftJoinAndSelect('mensualidad.jugador', 'jugador')
      .leftJoinAndSelect('jugador.categoria', 'categoria')
      .leftJoinAndSelect('mensualidad.pagos', 'pagos');

    // Filtros
    if (jugador_id) {
      query.andWhere('mensualidad.jugador_id = :jugador_id', { jugador_id });
    }

    if (mes) {
      query.andWhere('mensualidad.mes = :mes', { mes });
    }

    if (anio) {
      query.andWhere('mensualidad.anio = :anio', { anio });
    }

    if (estado) {
      query.andWhere('mensualidad.estado = :estado', { estado });
    }

    // Ordenamiento
    query.orderBy(`mensualidad.${sortBy}`, sortOrder);

    // Paginación
    query.skip(skip).take(limit);

    const [mensualidades, total] = await query.getManyAndCount();

    return PaginatedResultHelper.create(
      mensualidades,
      total,
      filterDto.page,
      limit,
    );
  }

  async findOne(id: number) {
    const mensualidad = await this.mensualidadRepository.findOne({
      where: { id },
      relations: ['jugador', 'jugador.categoria', 'pagos'],
    });

    if (!mensualidad) {
      throw new NotFoundException(`Mensualidad con ID ${id} no encontrada`);
    }

    return mensualidad;
  }

  async findByJugador(jugadorId: number) {
    const mensualidades = await this.mensualidadRepository.find({
      where: { jugador: { id: jugadorId } },
      relations: ['jugador', 'pagos'],
      order: { anio: 'DESC', mes: 'DESC' },
    });

    return mensualidades;
  }

  async findVencidas() {
    const hoy = new Date();
    
    // Obtener días de tolerancia de configuración
    const configTolerancia = await this.configuracionRepository.findOne({
      where: { clave: 'dias_tolerancia' },
    });
    
    const diasTolerancia = configTolerancia ? parseInt(configTolerancia.valor) : 5;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasTolerancia);

    const mensualidades = await this.mensualidadRepository.find({
      where: [
        {
          estado: EstadoMensualidad.PENDIENTE,
          fecha_vencimiento: LessThan(fechaLimite),
        },
        {
          estado: EstadoMensualidad.PARCIAL,
          fecha_vencimiento: LessThan(fechaLimite),
        },
      ],
      relations: ['jugador', 'jugador.categoria'],
      order: { fecha_vencimiento: 'ASC' },
    });

    return mensualidades;
  }

  async actualizarEstados() {
    const hoy = new Date();
    
    // Obtener días de tolerancia
    const configTolerancia = await this.configuracionRepository.findOne({
      where: { clave: 'dias_tolerancia' },
    });
    
    const diasTolerancia = configTolerancia ? parseInt(configTolerancia.valor) : 5;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - diasTolerancia);

    // Actualizar mensualidades vencidas
    const result = await this.mensualidadRepository
      .createQueryBuilder()
      .update(Mensualidad)
      .set({ estado: EstadoMensualidad.VENCIDO })
      .where('estado IN (:...estados)', {
        estados: [EstadoMensualidad.PENDIENTE, EstadoMensualidad.PARCIAL],
      })
      .andWhere('fecha_vencimiento < :fechaLimite', { fechaLimite })
      .execute();

    return {
      message: 'Estados actualizados correctamente',
      actualizadas: result.affected,
    };
  }

  async getResumenMes(mes: number, anio: number) {
    const mensualidades = await this.mensualidadRepository.find({
      where: { mes, anio },
      relations: ['jugador', 'pagos'],
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const totalMensualidades = mensualidades.length;
    const totalEsperado = mensualidades.reduce((sum, m) => sum + Number(m.monto), 0);
    const totalRecaudado = mensualidades.reduce((sum, m) => sum + Number(m.monto_pagado), 0);
    const totalPendiente = totalEsperado - totalRecaudado;

    // Pagadas: estado es PAGADO
    const pagadas = mensualidades.filter(m => m.estado === EstadoMensualidad.PAGADO).length;

    // Vencidas: NO pagadas Y fecha_vencimiento < hoy (basado en fecha, no en estado)
    const vencidas = mensualidades.filter(m => {
      if (m.estado === EstadoMensualidad.PAGADO) return false;
      const fechaVenc = new Date(m.fecha_vencimiento);
      fechaVenc.setHours(0, 0, 0, 0);
      return fechaVenc < hoy;
    }).length;

    // Pendientes: estado PENDIENTE Y fecha_vencimiento >= hoy (aún no vencidas)
    const pendientes = mensualidades.filter(m => {
      if (m.estado !== EstadoMensualidad.PENDIENTE) return false;
      const fechaVenc = new Date(m.fecha_vencimiento);
      fechaVenc.setHours(0, 0, 0, 0);
      return fechaVenc >= hoy;
    }).length;

    // Parciales: estado PARCIAL Y fecha_vencimiento >= hoy (aún no vencidas)
    const parciales = mensualidades.filter(m => {
      if (m.estado !== EstadoMensualidad.PARCIAL) return false;
      const fechaVenc = new Date(m.fecha_vencimiento);
      fechaVenc.setHours(0, 0, 0, 0);
      return fechaVenc >= hoy;
    }).length;

    return {
      mes,
      anio,
      total_mensualidades: totalMensualidades,
      total_jugadores: totalMensualidades,
      total_esperado: totalEsperado,
      total_recaudado: totalRecaudado,
      total_pendiente: totalPendiente,
      porcentaje_recaudo: totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 100) : 0,
      porcentaje_cumplimiento: totalMensualidades > 0 ? Math.round((pagadas / totalMensualidades) * 100) : 0,
      pagadas,
      pendientes,
      vencidas,
      parciales,
    };
  }

  async registrarPago(id: number, montoPagado: number) {
    const mensualidad = await this.findOne(id);

    if (mensualidad.estado === EstadoMensualidad.PAGADO) {
      throw new BadRequestException('Esta mensualidad ya está pagada');
    }

    const nuevoMontoPagado = Number(mensualidad.monto_pagado) + montoPagado;
    const nuevoSaldoPendiente = Number(mensualidad.monto) - nuevoMontoPagado;

    mensualidad.monto_pagado = nuevoMontoPagado;
    mensualidad.saldo_pendiente = nuevoSaldoPendiente;

    // Actualizar estado
    if (nuevoSaldoPendiente <= 0) {
      mensualidad.estado = EstadoMensualidad.PAGADO;
      mensualidad.saldo_pendiente = 0;
    } else {
      mensualidad.estado = EstadoMensualidad.PARCIAL;
    }

    await this.mensualidadRepository.save(mensualidad);

    return mensualidad;
  }

  async update(id: number, dto: UpdateMensualidadDto) {
    const mensualidad = await this.findOne(id);

    if (dto.fecha_vencimiento) {
      // Usar mediodía UTC para evitar problemas de timezone
      mensualidad.fecha_vencimiento = new Date(dto.fecha_vencimiento + 'T12:00:00.000Z');
    }

    await this.mensualidadRepository.save(mensualidad);

    return {
      message: 'Mensualidad actualizada correctamente',
      data: mensualidad,
    };
  }

  async delete(id: number) {
    const mensualidad = await this.findOne(id);

    // Solo permitir eliminar mensualidades pendientes
    if (mensualidad.estado === EstadoMensualidad.PAGADO) {
      throw new BadRequestException(
        'No se puede eliminar una mensualidad que ya fue pagada',
      );
    }

    if (mensualidad.estado === EstadoMensualidad.PARCIAL) {
      throw new BadRequestException(
        'No se puede eliminar una mensualidad con pagos parciales',
      );
    }

    // Verificar que no tenga pagos asociados
    if (mensualidad.pagos && mensualidad.pagos.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar una mensualidad que tiene pagos asociados',
      );
    }

    await this.mensualidadRepository.remove(mensualidad);

    return {
      message: 'Mensualidad eliminada correctamente',
    };
  }
}
