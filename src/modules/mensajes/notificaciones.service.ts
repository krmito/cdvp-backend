import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Jugador } from '@entities/jugador.entity';
import { Mensualidad } from '@entities/mensualidad.entity';

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail: string;
  private readonly clubName: string;
  private readonly clubPhone: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>(
      'RESEND_FROM',
      'Club Deportivo <onboarding@resend.dev>',
    );
    this.clubName = this.configService.get<string>('CLUB_NAME', 'Club Deportivo Pancho Villegas');
    this.clubPhone = this.configService.get<string>('CLUB_PHONE', '');

    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.logger.log('Resend configurado correctamente');
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY no configurada — los emails no se enviarán');
    }
  }

  private getRecipients(jugador: Jugador): string[] {
    const emails = new Set<string>();
    if (jugador.email) emails.add(jugador.email.toLowerCase().trim());
    if (jugador.email_acudiente) emails.add(jugador.email_acudiente.toLowerCase().trim());
    return Array.from(emails);
  }

  private formatFecha(fecha: Date | string): string {
    const d = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00Z') : fecha;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  private buildNuevaMensualidadHtml(ctx: {
    jugadorNombre: string;
    categoria: string;
    mesNombre: string;
    anio: number;
    monto: string;
    fechaVencimiento: string;
  }): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #1a73e8; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .content { padding: 24px; color: #333; }
    .content h2 { color: #1a73e8; font-size: 18px; margin-top: 0; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .info-table td:first-child { font-weight: bold; color: #555; width: 40%; }
    .amount { font-size: 24px; font-weight: bold; color: #1a73e8; text-align: center; padding: 16px; background: #e8f0fe; border-radius: 8px; margin: 16px 0; }
    .footer { background-color: #f8f9fa; padding: 16px 24px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.clubName}</h1>
    </div>
    <div class="content">
      <h2>Nueva Mensualidad Generada</h2>
      <p>Hola, se ha generado una nueva mensualidad para <strong>${ctx.jugadorNombre}</strong>.</p>
      <table class="info-table">
        <tr><td>Jugador</td><td>${ctx.jugadorNombre}</td></tr>
        <tr><td>Categor\u00eda</td><td>${ctx.categoria}</td></tr>
        <tr><td>Per\u00edodo</td><td>${ctx.mesNombre} ${ctx.anio}</td></tr>
        <tr><td>Fecha de vencimiento</td><td>${ctx.fechaVencimiento}</td></tr>
      </table>
      <div class="amount">Monto: $${ctx.monto}</div>
      <p>Por favor realice el pago antes de la fecha de vencimiento para evitar recargos.</p>
    </div>
    <div class="footer">
      <p>${this.clubName} | Tel: ${this.clubPhone}</p>
      <p>Este es un mensaje autom\u00e1tico, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildRecordatorioHtml(ctx: {
    jugadorNombre: string;
    categoria: string;
    mesNombre: string;
    anio: number;
    saldoPendiente: string;
    fechaVencimiento: string;
  }): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #e8a400; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .content { padding: 24px; color: #333; }
    .content h2 { color: #e8a400; font-size: 18px; margin-top: 0; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .info-table td:first-child { font-weight: bold; color: #555; width: 40%; }
    .amount { font-size: 24px; font-weight: bold; color: #e8a400; text-align: center; padding: 16px; background: #fff8e1; border-radius: 8px; margin: 16px 0; }
    .warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px 16px; margin: 16px 0; color: #856404; }
    .footer { background-color: #f8f9fa; padding: 16px 24px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.clubName}</h1>
    </div>
    <div class="content">
      <h2>Recordatorio de Pago</h2>
      <p>Hola, le recordamos que la mensualidad de <strong>${ctx.jugadorNombre}</strong> est\u00e1 pr\u00f3xima a vencer.</p>
      <div class="warning">
        La fecha de vencimiento es el <strong>${ctx.fechaVencimiento}</strong>. Quedan 2 d\u00edas para realizar el pago.
      </div>
      <table class="info-table">
        <tr><td>Jugador</td><td>${ctx.jugadorNombre}</td></tr>
        <tr><td>Categor\u00eda</td><td>${ctx.categoria}</td></tr>
        <tr><td>Per\u00edodo</td><td>${ctx.mesNombre} ${ctx.anio}</td></tr>
        <tr><td>Fecha de vencimiento</td><td>${ctx.fechaVencimiento}</td></tr>
      </table>
      <div class="amount">Saldo pendiente: $${ctx.saldoPendiente}</div>
      <p>Por favor realice el pago a la mayor brevedad para evitar recargos.</p>
    </div>
    <div class="footer">
      <p>${this.clubName} | Tel: ${this.clubPhone}</p>
      <p>Este es un mensaje autom\u00e1tico, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  async enviarNotificacionNuevaMensualidad(
    jugador: Jugador,
    mensualidad: Mensualidad,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Resend no configurado — email no enviado');
      return;
    }

    const recipients = this.getRecipients(jugador);
    if (recipients.length === 0) {
      this.logger.warn(`Jugador ${jugador.id} (${jugador.nombre} ${jugador.apellido}) no tiene emails configurados`);
      return;
    }

    const ctx = {
      jugadorNombre: `${jugador.nombre} ${jugador.apellido}`,
      categoria: jugador.categoria?.nombre || 'N/A',
      mesNombre: MESES[mensualidad.mes] || `Mes ${mensualidad.mes}`,
      anio: mensualidad.anio,
      monto: Number(mensualidad.monto).toLocaleString('es-CO'),
      fechaVencimiento: this.formatFecha(mensualidad.fecha_vencimiento),
    };

    const subject = `Nueva mensualidad ${MESES[mensualidad.mes]} ${mensualidad.anio} - ${this.clubName}`;
    const html = this.buildNuevaMensualidadHtml(ctx);

    for (const to of recipients) {
      try {
        const { error } = await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
        if (error) {
          this.logger.error(`Error enviando email a ${to}: ${error.message}`);
        } else {
          this.logger.log(`Email nueva mensualidad enviado a ${to} (Jugador: ${jugador.nombre} ${jugador.apellido})`);
        }
      } catch (error) {
        this.logger.error(`Error enviando email a ${to}: ${error.message}`);
      }
    }
  }

  async enviarRecordatorioVencimiento(
    jugador: Jugador,
    mensualidad: Mensualidad,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Resend no configurado — email no enviado');
      return;
    }

    const recipients = this.getRecipients(jugador);
    if (recipients.length === 0) return;

    const ctx = {
      jugadorNombre: `${jugador.nombre} ${jugador.apellido}`,
      categoria: jugador.categoria?.nombre || 'N/A',
      mesNombre: MESES[mensualidad.mes] || `Mes ${mensualidad.mes}`,
      anio: mensualidad.anio,
      saldoPendiente: Number(mensualidad.saldo_pendiente).toLocaleString('es-CO'),
      fechaVencimiento: this.formatFecha(mensualidad.fecha_vencimiento),
    };

    const subject = `Recordatorio de pago - ${MESES[mensualidad.mes]} ${mensualidad.anio} - ${this.clubName}`;
    const html = this.buildRecordatorioHtml(ctx);

    for (const to of recipients) {
      try {
        const { error } = await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
        if (error) {
          this.logger.error(`Error enviando recordatorio a ${to}: ${error.message}`);
        } else {
          this.logger.log(`Recordatorio enviado a ${to} (Jugador: ${jugador.nombre} ${jugador.apellido})`);
        }
      } catch (error) {
        this.logger.error(`Error enviando recordatorio a ${to}: ${error.message}`);
      }
    }
  }

  private buildAutoGeneracionHtml(ctx: {
    mesNombre: string;
    anio: number;
    generadas: number;
  }): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background-color: #1a73e8; color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .content { padding: 24px; color: #333; }
    .content h2 { color: #1a73e8; font-size: 18px; margin-top: 0; }
    .info-box { background: #e8f0fe; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center; }
    .info-box .mes { font-size: 24px; font-weight: bold; color: #1a73e8; }
    .info-box .count { font-size: 18px; color: #333; margin-top: 8px; }
    .footer { background-color: #f8f9fa; padding: 16px 24px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${this.clubName}</h1>
    </div>
    <div class="content">
      <h2>Mensualidades Generadas Autom\u00e1ticamente</h2>
      <p>Hola Administrador,</p>
      <p>Se han generado autom\u00e1ticamente las mensualidades del mes.</p>
      <div class="info-box">
        <div class="mes">${ctx.mesNombre} ${ctx.anio}</div>
        <div class="count">${ctx.generadas} mensualidad${ctx.generadas !== 1 ? 'es' : ''} generada${ctx.generadas !== 1 ? 's' : ''}</div>
      </div>
      <p>Puede revisar el detalle desde el panel de administraci\u00f3n en la secci\u00f3n de mensualidades.</p>
    </div>
    <div class="footer">
      <p>${this.clubName} | Tel: ${this.clubPhone}</p>
      <p>Este es un mensaje autom\u00e1tico, por favor no responda a este correo.</p>
    </div>
  </div>
</body>
</html>`;
  }

  async enviarNotificacionAutoGeneracion(
    emails: string[],
    generadas: number,
    mes: number,
    anio: number,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Resend no configurado — email no enviado');
      return;
    }

    if (emails.length === 0) {
      this.logger.warn('No hay emails de administradores para notificar auto-generaci\u00f3n');
      return;
    }

    const mesNombre = MESES[mes] || `Mes ${mes}`;
    const subject = `Mensualidades generadas: ${generadas} para ${mesNombre} ${anio} - ${this.clubName}`;
    const html = this.buildAutoGeneracionHtml({ mesNombre, anio, generadas });

    for (const to of emails) {
      try {
        const { error } = await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
        if (error) {
          this.logger.error(`Error enviando notificaci\u00f3n auto-generaci\u00f3n a ${to}: ${error.message}`);
        } else {
          this.logger.log(`Notificaci\u00f3n de auto-generaci\u00f3n enviada a ${to}`);
        }
      } catch (error) {
        this.logger.error(`Error enviando notificaci\u00f3n auto-generaci\u00f3n a ${to}: ${error.message}`);
      }
    }
  }

  private buildResumenMensualHtml(ctx: {
    mesNombre: string;
    anio: number;
    totalEsperado: number;
    totalRecaudado: number;
    totalPendiente: number;
    porcentajeCumplimiento: number;
    totalMensualidades: number;
    pagadas: number;
    pendientes: number;
    vencidas: number;
    parciales: number;
    totalMorosos: number;
    deudaTotal: number;
    categorias: Array<{
      categoria: string;
      esperado: number;
      recaudado: number;
      pagadas: number;
      pendientes: number;
      vencidas: number;
      porcentaje_cumplimiento: number;
    }>;
  }): string {
    const fmt = (n: number) => Number(n).toLocaleString('es-CO');
    const pct = Math.min(100, Math.round(ctx.porcentajeCumplimiento));
    const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

    const filasCategoria = ctx.categorias
      .map(
        (c) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;">${c.categoria}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;">$${fmt(c.esperado)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;color:#10b981;font-weight:600;">$${fmt(c.recaudado)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;">${c.pagadas}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;color:#f59e0b;">${c.pendientes}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;color:#ef4444;">${c.vencidas}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;">${Math.round(c.porcentaje_cumplimiento)}%</td>
      </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f0f4f8; }
    .wrap { max-width: 640px; margin: 20px auto; }
    .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.1); margin-bottom: 16px; }
    .header { background: linear-gradient(135deg, #1a3a5c 0%, #0d1f33 100%); color: white; padding: 32px 28px; text-align: center; }
    .header h1 { margin: 0 0 4px; font-size: 22px; }
    .header .periodo { font-size: 28px; font-weight: 700; color: #ffde00; margin: 8px 0; }
    .header .subtitle { font-size: 14px; opacity: 0.75; }
    .section { padding: 24px 28px; }
    .section-title { font-size: 15px; font-weight: 700; color: #1a3a5c; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .kpi { background: #f8fafc; border-radius: 10px; padding: 16px; text-align: center; }
    .kpi .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .kpi .value { font-size: 22px; font-weight: 700; }
    .kpi.esperado .value { color: #1a3a5c; }
    .kpi.recaudado .value { color: #10b981; }
    .kpi.pendiente .value { color: #f59e0b; }
    .kpi.pct .value { color: ${barColor}; }
    .progress-wrap { margin: 16px 0; }
    .progress-label { display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; margin-bottom: 6px; }
    .progress-bg { background: #e5e7eb; border-radius: 8px; height: 16px; overflow: hidden; }
    .progress-fill { height: 100%; background: ${barColor}; border-radius: 8px; width: ${pct}%; }
    .status-row { display: flex; gap: 8px; margin-top: 16px; }
    .badge { flex: 1; text-align: center; padding: 10px 6px; border-radius: 8px; font-size: 13px; }
    .badge .num { font-size: 20px; font-weight: 700; display: block; }
    .badge.pagadas { background: #ecfdf5; color: #059669; }
    .badge.pendientes { background: #fffbeb; color: #d97706; }
    .badge.vencidas { background: #fef2f2; color: #dc2626; }
    .badge.parciales { background: #eff6ff; color: #2563eb; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; color: #374151; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.4px; }
    th:not(:first-child) { text-align: center; }
    .moroso-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px 20px; display: flex; align-items: center; gap: 16px; }
    .moroso-num { font-size: 36px; font-weight: 700; color: #dc2626; }
    .moroso-info .title { font-weight: 700; color: #991b1b; font-size: 15px; }
    .moroso-info .sub { color: #dc2626; font-size: 13px; margin-top: 4px; }
    .footer { background: #f8f9fa; padding: 16px 28px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <h1>${this.clubName}</h1>
        <div class="periodo">${ctx.mesNombre} ${ctx.anio}</div>
        <div class="subtitle">Resumen financiero mensual — ${ctx.totalMensualidades} mensualidades generadas</div>
      </div>

      <div class="section">
        <div class="section-title">Recaudación del mes</div>
        <div class="kpi-grid">
          <div class="kpi esperado">
            <div class="label">Total esperado</div>
            <div class="value">$${fmt(ctx.totalEsperado)}</div>
          </div>
          <div class="kpi recaudado">
            <div class="label">Total recaudado</div>
            <div class="value">$${fmt(ctx.totalRecaudado)}</div>
          </div>
          <div class="kpi pendiente">
            <div class="label">Saldo pendiente</div>
            <div class="value">$${fmt(ctx.totalPendiente)}</div>
          </div>
          <div class="kpi pct">
            <div class="label">Cumplimiento</div>
            <div class="value">${pct}%</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label">
            <span>$${fmt(ctx.totalRecaudado)} recaudado</span>
            <span>meta $${fmt(ctx.totalEsperado)}</span>
          </div>
          <div class="progress-bg"><div class="progress-fill"></div></div>
        </div>
        <div class="status-row">
          <div class="badge pagadas"><span class="num">${ctx.pagadas}</span>Pagadas</div>
          <div class="badge parciales"><span class="num">${ctx.parciales}</span>Parciales</div>
          <div class="badge pendientes"><span class="num">${ctx.pendientes}</span>Pendientes</div>
          <div class="badge vencidas"><span class="num">${ctx.vencidas}</span>Vencidas</div>
        </div>
      </div>
    </div>

    ${ctx.categorias.length > 0 ? `
    <div class="card">
      <div class="section">
        <div class="section-title">Desglose por categor\u00eda</div>
        <table>
          <thead>
            <tr>
              <th>Categor\u00eda</th>
              <th style="text-align:right;">Esperado</th>
              <th style="text-align:right;">Recaudado</th>
              <th>Pagadas</th>
              <th>Pend.</th>
              <th>Venc.</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>${filasCategoria}</tbody>
        </table>
      </div>
    </div>` : ''}

    ${ctx.totalMorosos > 0 ? `
    <div class="card">
      <div class="section">
        <div class="section-title">Situaci\u00f3n de morosidad</div>
        <div class="moroso-box">
          <div class="moroso-num">${ctx.totalMorosos}</div>
          <div class="moroso-info">
            <div class="title">jugador${ctx.totalMorosos !== 1 ? 'es' : ''} con deuda pendiente</div>
            <div class="sub">Deuda total acumulada: $${fmt(ctx.deudaTotal)}</div>
          </div>
        </div>
      </div>
    </div>` : `
    <div class="card">
      <div class="section">
        <div class="section-title">Situaci\u00f3n de morosidad</div>
        <div style="background:#ecfdf5;border-radius:10px;padding:16px 20px;color:#059669;font-weight:600;text-align:center;">
          Sin morosos al cierre del mes
        </div>
      </div>
    </div>`}

    <div class="footer">
      <p>${this.clubName}${this.clubPhone ? ' | Tel: ' + this.clubPhone : ''}</p>
      <p>Este resumen fue generado autom\u00e1ticamente al cierre del mes.</p>
    </div>
  </div>
</body>
</html>`;
  }

  async enviarResumenMensual(
    emails: string[],
    ctx: {
      mes: number;
      anio: number;
      totalEsperado: number;
      totalRecaudado: number;
      totalPendiente: number;
      porcentajeCumplimiento: number;
      totalMensualidades: number;
      pagadas: number;
      pendientes: number;
      vencidas: number;
      parciales: number;
      totalMorosos: number;
      deudaTotal: number;
      categorias: Array<{
        categoria: string;
        esperado: number;
        recaudado: number;
        pagadas: number;
        pendientes: number;
        vencidas: number;
        porcentaje_cumplimiento: number;
      }>;
    },
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn('Resend no configurado — resumen mensual no enviado');
      return;
    }
    if (emails.length === 0) {
      this.logger.warn('No hay emails de administradores para el resumen mensual');
      return;
    }

    const mesNombre = MESES[ctx.mes] || `Mes ${ctx.mes}`;
    const subject = `Resumen mensual ${mesNombre} ${ctx.anio} — ${this.clubName}`;
    const html = this.buildResumenMensualHtml({ ...ctx, mesNombre });

    for (const to of emails) {
      try {
        const { error } = await this.resend.emails.send({
          from: this.fromEmail,
          to,
          subject,
          html,
        });
        if (error) {
          this.logger.error(`Error enviando resumen mensual a ${to}: ${error.message}`);
        } else {
          this.logger.log(`Resumen mensual ${mesNombre} ${ctx.anio} enviado a ${to}`);
        }
      } catch (err) {
        this.logger.error(`Error enviando resumen mensual a ${to}: ${err.message}`);
      }
    }
  }

  async enviarNotificacionesMasivas(
    lista: { jugador: Jugador; mensualidad: Mensualidad }[],
  ): Promise<void> {
    this.logger.log(`Iniciando envío masivo de ${lista.length} notificaciones...`);
    let enviados = 0;
    let errores = 0;

    for (const { jugador, mensualidad } of lista) {
      try {
        await this.enviarNotificacionNuevaMensualidad(jugador, mensualidad);
        enviados++;
      } catch (error) {
        errores++;
        this.logger.error(`Error en envío masivo para jugador ${jugador.id}: ${error.message}`);
      }
      // Delay de 200ms entre emails para respetar rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.log(`Envío masivo completado: ${enviados} enviados, ${errores} errores`);
  }
}
