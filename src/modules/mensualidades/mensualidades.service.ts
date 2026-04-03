import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, In } from 'typeorm';
import { Mensualidad, EstadoMensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { GenerarMensualidadesDto, UpdateMensualidadDto } from './dto/generar-mensualidades.dto';
import { FilterMensualidadDto } from './dto/filter-mensualidad.dto';
import { PaginatedResultHelper } from '@common/dto/paginated-result.interface';
import { NotificacionesService } from '../mensajes/notificaciones.service';
import { getNowBogota } from '@common/utils/date.utils';

@Injectable()
export class MensualidadesService {
  private readonly logger = new Logger(MensualidadesService.name);

  constructor(
    @InjectRepository(Mensualidad)
    private readonly mensualidadRepository: Repository<Mensualidad>,
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
    @InjectRepository(Configuracion)
    private readonly configuracionRepository: Repository<Configuracion>,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  async generarMensualidades(dto: GenerarMensualidadesDto) {
    const hoy = getNowBogota();
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

    // Último día del mes objetivo (para comparar fecha_ingreso)
    const ultimoDiaMes = new Date(anio, mes, 0); // día 0 del mes siguiente = último del mes actual
    ultimoDiaMes.setHours(23, 59, 59, 999);

    // Filtrar jugadores que NO tienen mensualidad para este período
    // y cuya fecha_ingreso (si existe) no supera el mes objetivo
    const jugadoresSinMensualidad = jugadores.filter((j) => {
      if (jugadoresConMensualidad.has(j.id)) return false;
      if (!j.fecha_ingreso) return true;
      return new Date(j.fecha_ingreso) <= ultimoDiaMes;
    });

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
      // Por defecto: 30 días desde hoy en hora Bogotá (mediodía UTC)
      const hoy = getNowBogota();
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
      mensualidadesCreadas.push({ jugador, mensualidad: saved });
    }

    // Fire-and-forget: enviar notificaciones sin bloquear la respuesta HTTP
    if (mensualidadesCreadas.length > 0) {
      this.notificacionesService
        .enviarNotificacionesMasivas(mensualidadesCreadas)
        .catch((err) => this.logger.error(`Error en envío masivo: ${err.message}`));
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
    const { search, jugador_id, mes, anio, estado } = filterDto;

    const hoy = getNowBogota();
    hoy.setHours(0, 0, 0, 0);

    const query = this.mensualidadRepository
      .createQueryBuilder('mensualidad')
      .leftJoinAndSelect('mensualidad.jugador', 'jugador')
      .leftJoinAndSelect('jugador.categoria', 'categoria')
      .leftJoinAndSelect('mensualidad.pagos', 'pagos');

    // Filtros
    if (search) {
      query.andWhere(
        '(jugador.nombre ILIKE :search OR jugador.apellido ILIKE :search OR jugador.documento ILIKE :search OR CONCAT(jugador.nombre, \' \', jugador.apellido) ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (jugador_id) {
      query.andWhere('mensualidad.jugador_id = :jugador_id', { jugador_id });
    }

    if (mes) {
      query.andWhere('mensualidad.mes = :mes', { mes });
    }

    if (anio) {
      query.andWhere('mensualidad.anio = :anio', { anio });
    }

    // Filtro de estado con lógica de vencimiento por fecha
    if (estado) {
      if (estado === 'vencido') {
        // Vencidas: NO pagadas Y fecha_vencimiento < hoy
        query.andWhere('mensualidad.estado != :estadoPagado', { estadoPagado: EstadoMensualidad.PAGADO });
        query.andWhere('mensualidad.fecha_vencimiento < :hoy', { hoy });
      } else if (estado === 'pendiente') {
        // Pendientes: estado pendiente Y fecha_vencimiento >= hoy
        query.andWhere('mensualidad.estado = :estado', { estado });
        query.andWhere('mensualidad.fecha_vencimiento >= :hoy', { hoy });
      } else if (estado === 'parcial') {
        // Parciales: estado parcial Y fecha_vencimiento >= hoy
        query.andWhere('mensualidad.estado = :estado', { estado });
        query.andWhere('mensualidad.fecha_vencimiento >= :hoy', { hoy });
      } else {
        query.andWhere('mensualidad.estado = :estado', { estado });
      }
    }

    // Ordenamiento
    query.orderBy(`mensualidad.${sortBy}`, sortOrder);

    // Paginación
    query.skip(skip).take(limit);

    const [mensualidades, total] = await query.getManyAndCount();

    // Actualizar el estado mostrado basado en fecha_vencimiento
    const mensualidadesConEstadoActualizado = mensualidades.map(m => {
      const fechaVenc = new Date(m.fecha_vencimiento);
      fechaVenc.setHours(0, 0, 0, 0);

      // Si no está pagada y la fecha de vencimiento ya pasó, mostrar como vencido
      if (m.estado !== EstadoMensualidad.PAGADO && fechaVenc < hoy) {
        return { ...m, estado: EstadoMensualidad.VENCIDO };
      }
      return m;
    });

    return PaginatedResultHelper.create(
      mensualidadesConEstadoActualizado,
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
    const hoy = getNowBogota();

    // Obtener días de tolerancia de configuración
    const configTolerancia = await this.configuracionRepository.findOne({
      where: { clave: 'dias_tolerancia' },
    });
    
    const diasTolerancia = configTolerancia ? parseInt(configTolerancia.valor) : 5;
    const fechaLimite = getNowBogota();
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
    const hoy = getNowBogota();

    // Obtener días de tolerancia
    const configTolerancia = await this.configuracionRepository.findOne({
      where: { clave: 'dias_tolerancia' },
    });
    
    const diasTolerancia = configTolerancia ? parseInt(configTolerancia.valor) : 5;
    const fechaLimite = getNowBogota();
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

    const hoy = getNowBogota();
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

    // Aplicar o quitar descuento y recalcular monto_pagado + saldo
    if ('monto_descuento' in dto) {
      const monto = Number(mensualidad.monto);

      // Crédito anterior (si había descuento aplicado)
      const creditoAnterior = mensualidad.monto_descuento != null
        ? monto - Number(mensualidad.monto_descuento)
        : 0;

      // Crédito nuevo
      const nuevoDescuento = dto.monto_descuento ?? null;
      const creditoNuevo = nuevoDescuento != null
        ? monto - Number(nuevoDescuento)
        : 0;

      // Ajustar monto_pagado: quitar crédito anterior, sumar crédito nuevo
      const nuevoPagado = Math.max(0, Number(mensualidad.monto_pagado) - creditoAnterior + creditoNuevo);
      const nuevoSaldo = Math.max(0, monto - nuevoPagado);

      mensualidad.monto_descuento = nuevoDescuento;
      mensualidad.monto_pagado = nuevoPagado;
      mensualidad.saldo_pendiente = nuevoSaldo;
      mensualidad.estado = nuevoSaldo <= 0
        ? EstadoMensualidad.PAGADO
        : nuevoPagado > 0
          ? EstadoMensualidad.PARCIAL
          : EstadoMensualidad.PENDIENTE;
    }

    await this.mensualidadRepository.save(mensualidad);

    return {
      message: 'Mensualidad actualizada correctamente',
      data: mensualidad,
    };
  }

  async generarMensualidadParaNuevoJugador(jugador: Jugador): Promise<void> {
    const hoy = getNowBogota();
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();

    // Verificar que este jugador no tenga ya una mensualidad para el período
    const yaExiste = await this.mensualidadRepository.findOne({
      where: { jugador: { id: jugador.id }, mes, anio },
    });

    if (yaExiste) {
      return;
    }

    // Asegurar que la categoría esté cargada
    if (!jugador.categoria) {
      const jugadorConCategoria = await this.jugadorRepository.findOne({
        where: { id: jugador.id },
        relations: ['categoria'],
      });
      if (!jugadorConCategoria?.categoria) {
        this.logger.warn(`Jugador ${jugador.id} no tiene categoría asignada — no se genera mensualidad`);
        return;
      }
      jugador = jugadorConCategoria;
    }

    // Intentar copiar fecha_vencimiento de una mensualidad existente del mes, o calcular 30 días
    const existente = await this.mensualidadRepository.findOne({
      where: { mes, anio },
    });
    const fechaVencimiento = existente
      ? existente.fecha_vencimiento
      : new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 30, 12, 0, 0)); // hoy ya está en hora Bogotá

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
    this.logger.log(`Mensualidad auto-generada para jugador ${jugador.id} (${jugador.nombre} ${jugador.apellido}) — ${mes}/${anio}`);

    // Fire-and-forget: notificar al jugador
    this.notificacionesService
      .enviarNotificacionNuevaMensualidad(jugador, saved)
      .catch((err) => this.logger.error(`Error notificando nuevo jugador ${jugador.id}: ${err.message}`));
  }

  async reenviarNotificaciones(jugadorId: number): Promise<{ message: string; enviadas: number }> {
    const jugador = await this.jugadorRepository.findOne({
      where: { id: jugadorId },
      relations: ['categoria'],
    });

    if (!jugador) throw new NotFoundException('Jugador no encontrado');

    if (!jugador.email && !jugador.email_acudiente) {
      throw new BadRequestException('El jugador no tiene correo registrado');
    }

    const mensualidades = await this.mensualidadRepository.find({
      where: {
        jugador: { id: jugadorId },
        estado: In([EstadoMensualidad.PENDIENTE, EstadoMensualidad.PARCIAL, EstadoMensualidad.VENCIDO]),
      },
      order: { anio: 'DESC', mes: 'DESC' },
    });

    if (mensualidades.length === 0) {
      return { message: 'No hay mensualidades pendientes para notificar', enviadas: 0 };
    }

    const lista = mensualidades.map((m) => ({ jugador, mensualidad: m }));

    // Fire-and-forget
    this.notificacionesService
      .enviarNotificacionesMasivas(lista)
      .catch((err) => this.logger.error(`Error reenviando notificaciones jugador ${jugadorId}: ${err.message}`));

    return {
      message: `Se enviaron ${mensualidades.length} notificaciones`,
      enviadas: mensualidades.length,
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
