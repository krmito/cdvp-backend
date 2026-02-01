import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, In, MoreThan } from 'typeorm';
import { Pago } from '@entities/pago.entity';
import { Mensualidad, EstadoMensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagoRepository: Repository<Pago>,
    @InjectRepository(Mensualidad)
    private readonly mensualidadRepository: Repository<Mensualidad>,
    @InjectRepository(Jugador)
    private readonly jugadorRepository: Repository<Jugador>,
  ) {}

  async reporteCaja(
    fechaInicio: string,
    fechaFin: string,
    agruparPor: 'dia' | 'metodo' = 'dia',
    mes?: number,
    anio?: number,
  ) {
    const query = this.pagoRepository
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.jugador', 'jugador')
      .leftJoinAndSelect('pago.mensualidad', 'mensualidad')
      .where('pago.anulado = :anulado', { anulado: false });

    // Si se especifica mes y año, filtrar por mensualidad
    if (mes && anio) {
      query
        .andWhere('mensualidad.mes = :mes', { mes })
        .andWhere('mensualidad.anio = :anio', { anio });
    } else if (fechaInicio && fechaFin) {
      // Si no, filtrar por fecha de pago
      query
        .andWhere('DATE(pago.fecha_pago) >= :fechaInicio', { fechaInicio })
        .andWhere('DATE(pago.fecha_pago) <= :fechaFin', { fechaFin });
    }

    const pagos = await query.orderBy('pago.fecha_pago', 'ASC').getMany();

    const totalRecaudado = pagos.reduce(
      (sum, p) => sum + Number(p.monto_pagado),
      0,
    );

    const agrupado: Record<string, any> = {};

    if (agruparPor === 'metodo') {
      pagos.forEach((p) => {
        if (!agrupado[p.metodo_pago]) {
          agrupado[p.metodo_pago] = { pagos: [], total: 0 };
        }
        agrupado[p.metodo_pago].pagos.push(p);
        agrupado[p.metodo_pago].total += Number(p.monto_pagado);
      });
    } else {
      pagos.forEach((p) => {
        const fecha = p.fecha_pago.toISOString().split('T')[0];
        if (!agrupado[fecha]) {
          agrupado[fecha] = { pagos: [], total: 0 };
        }
        agrupado[fecha].pagos.push(p);
        agrupado[fecha].total += Number(p.monto_pagado);
      });
    }

    return {
      periodo: mes && anio ? { mes, anio } : { desde: fechaInicio, hasta: fechaFin },
      total_pagos: pagos.length,
      total_recaudado: totalRecaudado,
      agrupado,
    };
  }

  async reporteMorosos() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Buscar mensualidades vencidas, parciales, o pendientes con fecha vencida y saldo pendiente
    const mensualidadesDeuda = await this.mensualidadRepository.find({
      where: [
        { estado: EstadoMensualidad.VENCIDO },
        { estado: EstadoMensualidad.PARCIAL },
        {
          estado: EstadoMensualidad.PENDIENTE,
          fecha_vencimiento: LessThan(hoy),
          saldo_pendiente: MoreThan(0),
        },
      ],
      relations: ['jugador', 'jugador.categoria'],
      order: { fecha_vencimiento: 'ASC' },
    });

    const jugadoresMorosos = new Map<number, any>();

    mensualidadesDeuda.forEach((m) => {
      // Solo incluir si hay saldo pendiente
      if (Number(m.saldo_pendiente) <= 0) return;

      const key = m.jugador.id;
      if (!jugadoresMorosos.has(key)) {
        jugadoresMorosos.set(key, {
          jugador: m.jugador,
          mensualidades_vencidas: [],
          total_deuda: 0,
        });
      }

      const data = jugadoresMorosos.get(key);
      data.mensualidades_vencidas.push(m);
      data.total_deuda += Number(m.saldo_pendiente);
    });

    const morosos = Array.from(jugadoresMorosos.values());
    const totalDeuda = morosos.reduce((sum, m) => sum + m.total_deuda, 0);

    return {
      total_morosos: morosos.length,
      deuda_total: totalDeuda,
      morosos: morosos.sort((a, b) => b.total_deuda - a.total_deuda),
    };
  }

  async proyeccionIngresos(mes: number, anio: number) {
    const mensualidades = await this.mensualidadRepository.find({
      where: { mes, anio },
      relations: ['jugador'],
    });

    const totalEsperado = mensualidades.reduce(
      (sum, m) => sum + Number(m.monto),
      0,
    );
    const totalRecaudado = mensualidades.reduce(
      (sum, m) => sum + Number(m.monto_pagado),
      0,
    );
    const totalPendiente = totalEsperado - totalRecaudado;

    const pagadas = mensualidades.filter(
      (m) => m.estado === EstadoMensualidad.PAGADO,
    ).length;
    const pendientes = mensualidades.filter(
      (m) => m.estado === EstadoMensualidad.PENDIENTE,
    ).length;
    const vencidas = mensualidades.filter(
      (m) => m.estado === EstadoMensualidad.VENCIDO,
    ).length;

    return {
      mes,
      anio,
      total_esperado: totalEsperado,
      total_recaudado: totalRecaudado,
      total_pendiente: totalPendiente,
      porcentaje_cumplimiento:
        totalEsperado > 0 ? (totalRecaudado / totalEsperado) * 100 : 0,
      mensualidades: {
        total: mensualidades.length,
        pagadas,
        pendientes,
        vencidas,
      },
    };
  }

  async cumplimientoPorCategoria(mes: number, anio: number) {
    const mensualidades = await this.mensualidadRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.jugador', 'j')
      .leftJoinAndSelect('j.categoria', 'c')
      .where('m.mes = :mes AND m.anio = :anio', { mes, anio })
      .getMany();

    const porCategoria: Record<string, any> = {};

    mensualidades.forEach((m) => {
      const cat = m.jugador.categoria.nombre;
      if (!porCategoria[cat]) {
        porCategoria[cat] = {
          categoria: cat,
          total_mensualidades: 0,
          pagadas: 0,
          pendientes: 0,
          vencidas: 0,
          esperado: 0,
          recaudado: 0,
        };
      }

      const data = porCategoria[cat];
      data.total_mensualidades++;
      data.esperado += Number(m.monto);
      data.recaudado += Number(m.monto_pagado);

      if (m.estado === EstadoMensualidad.PAGADO) data.pagadas++;
      else if (m.estado === EstadoMensualidad.PENDIENTE) data.pendientes++;
      else if (m.estado === EstadoMensualidad.VENCIDO) data.vencidas++;
    });

    Object.values(porCategoria).forEach((cat: any) => {
      cat.porcentaje_cumplimiento =
        cat.esperado > 0 ? (cat.recaudado / cat.esperado) * 100 : 0;
    });

    return {
      mes,
      anio,
      categorias: Object.values(porCategoria),
    };
  }

  async estadisticasGenerales() {
    const totalJugadores = await this.jugadorRepository.count();
    const jugadoresActivos = await this.jugadorRepository.count({
      where: { activo: true },
    });

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1;
    const anioActual = hoy.getFullYear();

    // Obtener mensualidades del mes actual (consistente con el módulo de mensualidades)
    const mensualidadesMesActual = await this.mensualidadRepository.find({
      where: { mes: mesActual, anio: anioActual },
    });

    const recaudadoEsteMes = mensualidadesMesActual.reduce(
      (sum, m) => sum + Number(m.monto_pagado),
      0,
    );

    const pagadasEsteMes = mensualidadesMesActual.filter(
      (m) => m.estado === EstadoMensualidad.PAGADO,
    ).length;

    // Mensualidades pendientes y vencidas del mes actual
    const mensualidadesPendientes = mensualidadesMesActual.filter(
      (m) => m.estado === EstadoMensualidad.PENDIENTE,
    ).length;

    const mensualidadesVencidas = mensualidadesMesActual.filter(
      (m) => m.estado === EstadoMensualidad.VENCIDO,
    ).length;

    return {
      jugadores: {
        total: totalJugadores,
        activos: jugadoresActivos,
        inactivos: totalJugadores - jugadoresActivos,
      },
      mes_actual: {
        recaudado: recaudadoEsteMes,
        total_pagos: pagadasEsteMes,
      },
      mensualidades: {
        pendientes: mensualidadesPendientes,
        vencidas: mensualidadesVencidas,
      },
    };
  }
}
