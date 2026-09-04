import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Pago } from '@entities/pago.entity';
import { Mensualidad, EstadoMensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';
import { getNowBogota } from '@common/utils/date.utils';

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
      // Si no, filtrar por fecha de pago usando rangos completos de datetime
      const fechaInicioDatetime = new Date(fechaInicio + 'T00:00:00');
      const fechaFinDatetime = new Date(fechaFin + 'T23:59:59.999');
      query
        .andWhere('pago.fecha_pago >= :fechaInicioDatetime', { fechaInicioDatetime })
        .andWhere('pago.fecha_pago <= :fechaFinDatetime', { fechaFinDatetime });
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

  async reporteMorosos(mes?: number, anio?: number, categoriaId?: number) {
    const hoy = getNowBogota();
    hoy.setHours(0, 0, 0, 0);

    const query = this.mensualidadRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.jugador', 'jugador')
      .leftJoinAndSelect('jugador.categoria', 'categoria')
      .where(
        '(m.estado = :vencido OR m.estado = :parcial OR (m.estado = :pendiente AND m.fecha_vencimiento < :hoy AND m.saldo_pendiente > 0))',
        {
          vencido: EstadoMensualidad.VENCIDO,
          parcial: EstadoMensualidad.PARCIAL,
          pendiente: EstadoMensualidad.PENDIENTE,
          hoy,
        },
      )
      .andWhere('m.saldo_pendiente > 0')
      .orderBy('m.fecha_vencimiento', 'ASC');

    if (mes && anio) {
      query.andWhere('m.mes = :mes AND m.anio = :anio', { mes, anio });
    }

    if (categoriaId) {
      query.andWhere('categoria.id = :categoriaId', { categoriaId });
    }

    const mensualidadesDeuda = await query.getMany();

    const jugadoresMorosos = new Map<number, any>();

    mensualidadesDeuda.forEach((m) => {
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

    const hoy = getNowBogota();
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

    // Mensualidades pendientes del mes actual
    const mensualidadesPendientes = mensualidadesMesActual.filter(
      (m) => m.estado === EstadoMensualidad.PENDIENTE,
    ).length;

    // Mensualidades vencidas: todas las no pagadas con fecha_vencimiento pasada (cualquier mes)
    const mensualidadesVencidas = await this.mensualidadRepository.count({
      where: [
        {
          estado: EstadoMensualidad.VENCIDO,
        },
        {
          estado: EstadoMensualidad.PENDIENTE,
          fecha_vencimiento: LessThan(hoy),
        },
        {
          estado: EstadoMensualidad.PARCIAL,
          fecha_vencimiento: LessThan(hoy),
        },
      ],
    });

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

  async reportePosiblesInactivos(
    mesesConsecutivos: number = 3,
    categoriaId?: number,
    busqueda?: string,
  ) {
    const threshold = Math.max(1, mesesConsecutivos || 3);

    const query = this.jugadorRepository
      .createQueryBuilder('j')
      .leftJoinAndSelect('j.categoria', 'categoria')
      .leftJoinAndSelect('j.mensualidades', 'm', 'm.anulada = false OR m.anulada IS NULL')
      .where('j.activo = :activo', { activo: true })
      .orderBy('j.apellido', 'ASC')
      .addOrderBy('j.nombre', 'ASC')
      .addOrderBy('m.anio', 'DESC')
      .addOrderBy('m.mes', 'DESC');

    if (categoriaId) {
      query.andWhere('categoria.id = :categoriaId', { categoriaId });
    }

    if (busqueda && busqueda.trim().length > 0) {
      query.andWhere(
        '(LOWER(j.nombre) LIKE LOWER(:b) OR LOWER(j.apellido) LIKE LOWER(:b) OR j.documento LIKE :b)',
        { b: `%${busqueda.trim()}%` },
      );
    }

    const jugadores = await query.getMany();

    const jugadorIds = jugadores.map((j) => j.id);
    const ultimosPagosMap = new Map<number, { fecha: string; mes: number; anio: number; monto: number }>();

    if (jugadorIds.length > 0) {
      const pagosRaw = await this.pagoRepository
        .createQueryBuilder('p')
        .innerJoin('p.mensualidad', 'm')
        .select('p.jugador_id', 'jugador_id')
        .addSelect('p.fecha_pago', 'fecha_pago')
        .addSelect('p.monto_pagado', 'monto_pagado')
        .addSelect('m.mes', 'mes')
        .addSelect('m.anio', 'anio')
        .where('p.jugador_id IN (:...jugadorIds)', { jugadorIds })
        .andWhere('p.anulado = false')
        .orderBy('p.fecha_pago', 'DESC')
        .getRawMany();

      for (const p of pagosRaw) {
        const jId = Number(p.jugador_id);
        if (!ultimosPagosMap.has(jId)) {
          ultimosPagosMap.set(jId, {
            fecha: p.fecha_pago,
            mes: p.mes,
            anio: p.anio,
            monto: Number(p.monto_pagado),
          });
        }
      }
    }

    const MESES_NOMBRES = [
      '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    const candidatos: any[] = [];
    let deudaTotalGeneral = 0;

    for (const j of jugadores) {
      const mensualidades = j.mensualidades || [];
      mensualidades.sort((a, b) => {
        if (b.anio !== a.anio) return b.anio - a.anio;
        return b.mes - a.mes;
      });

      let streak = 0;
      const mesesAdeudados: any[] = [];
      let deudaJugador = 0;

      for (const m of mensualidades) {
        const saldo = Number(m.saldo_pendiente);
        const impago =
          (m.estado === EstadoMensualidad.PENDIENTE ||
            m.estado === EstadoMensualidad.VENCIDO ||
            m.estado === EstadoMensualidad.PARCIAL) &&
          saldo > 0;

        if (impago) {
          streak++;
          deudaJugador += saldo;
          mesesAdeudados.push({
            id: m.id,
            mes: m.mes,
            anio: m.anio,
            mesNombre: `${MESES_NOMBRES[m.mes] || 'Mes ' + m.mes} ${m.anio}`,
            monto: Number(m.monto),
            saldoPendiente: saldo,
            estado: m.estado,
          });
        } else {
          break;
        }
      }

      if (streak >= threshold) {
        deudaTotalGeneral += deudaJugador;
        const ultPago = ultimosPagosMap.get(j.id);

        candidatos.push({
          id: j.id,
          nombre: j.nombre,
          apellido: j.apellido,
          nombreCompleto: `${j.nombre} ${j.apellido}`.trim(),
          documento: j.documento,
          tipoDocumento: j.tipo_documento,
          telefono: j.telefono,
          telefonoAcudiente: j.telefono_acudiente,
          email: j.email,
          emailAcudiente: j.email_acudiente,
          fotoUrl: j.foto_url,
          fechaRegistro: j.fecha_registro,
          categoria: j.categoria
            ? {
                id: j.categoria.id,
                nombre: j.categoria.nombre,
                valorMensualidad: Number(j.categoria.valor_mensualidad),
              }
            : null,
          mesesConsecutivosSinPago: streak,
          totalDeuda: deudaJugador,
          mesesAdeudados,
          ultimoPago: ultPago
            ? {
                fecha: ultPago.fecha,
                mes: ultPago.mes,
                anio: ultPago.anio,
                mesNombre: `${MESES_NOMBRES[ultPago.mes] || 'Mes ' + ultPago.mes} ${ultPago.anio}`,
                monto: ultPago.monto,
              }
            : null,
        });
      }
    }

    candidatos.sort((a, b) => {
      if (b.mesesConsecutivosSinPago !== a.mesesConsecutivosSinPago) {
        return b.mesesConsecutivosSinPago - a.mesesConsecutivosSinPago;
      }
      return b.totalDeuda - a.totalDeuda;
    });

    return {
      criterioMeses: threshold,
      totalDetectados: candidatos.length,
      deudaTotalAcumulada: deudaTotalGeneral,
      jugadores: candidatos,
    };
  }
}
