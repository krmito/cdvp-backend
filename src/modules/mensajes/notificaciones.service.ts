import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { Jugador } from '@entities/jugador.entity';
import { Mensualidad } from '@entities/mensualidad.entity';

const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);
  private readonly clubName: string;
  private readonly clubPhone: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.clubName = this.configService.get<string>('CLUB_NAME', 'Club Deportivo Pancho Villegas');
    this.clubPhone = this.configService.get<string>('CLUB_PHONE', '');
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

  async enviarNotificacionNuevaMensualidad(
    jugador: Jugador,
    mensualidad: Mensualidad,
  ): Promise<void> {
    const recipients = this.getRecipients(jugador);
    if (recipients.length === 0) {
      this.logger.warn(`Jugador ${jugador.id} (${jugador.nombre} ${jugador.apellido}) no tiene emails configurados`);
      return;
    }

    const context = {
      jugadorNombre: `${jugador.nombre} ${jugador.apellido}`,
      categoria: jugador.categoria?.nombre || 'N/A',
      mesNombre: MESES[mensualidad.mes] || `Mes ${mensualidad.mes}`,
      anio: mensualidad.anio,
      monto: Number(mensualidad.monto).toLocaleString('es-CO'),
      fechaVencimiento: this.formatFecha(mensualidad.fecha_vencimiento),
      clubName: this.clubName,
      clubPhone: this.clubPhone,
    };

    for (const to of recipients) {
      try {
        await this.mailerService.sendMail({
          to,
          subject: `Nueva mensualidad ${MESES[mensualidad.mes]} ${mensualidad.anio} - ${this.clubName}`,
          template: 'nueva-mensualidad',
          context,
        });
        this.logger.log(`Email nueva mensualidad enviado a ${to} (Jugador: ${jugador.nombre} ${jugador.apellido})`);
      } catch (error) {
        this.logger.error(`Error enviando email a ${to}: ${error.message}`);
      }
    }
  }

  async enviarRecordatorioVencimiento(
    jugador: Jugador,
    mensualidad: Mensualidad,
  ): Promise<void> {
    const recipients = this.getRecipients(jugador);
    if (recipients.length === 0) return;

    const context = {
      jugadorNombre: `${jugador.nombre} ${jugador.apellido}`,
      categoria: jugador.categoria?.nombre || 'N/A',
      mesNombre: MESES[mensualidad.mes] || `Mes ${mensualidad.mes}`,
      anio: mensualidad.anio,
      saldoPendiente: Number(mensualidad.saldo_pendiente).toLocaleString('es-CO'),
      fechaVencimiento: this.formatFecha(mensualidad.fecha_vencimiento),
      clubName: this.clubName,
      clubPhone: this.clubPhone,
    };

    for (const to of recipients) {
      try {
        await this.mailerService.sendMail({
          to,
          subject: `Recordatorio de pago - ${MESES[mensualidad.mes]} ${mensualidad.anio} - ${this.clubName}`,
          template: 'recordatorio-vencimiento',
          context,
        });
        this.logger.log(`Recordatorio enviado a ${to} (Jugador: ${jugador.nombre} ${jugador.apellido})`);
      } catch (error) {
        this.logger.error(`Error enviando recordatorio a ${to}: ${error.message}`);
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
      // Delay de 200ms entre emails para respetar rate limit de Gmail
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    this.logger.log(`Envío masivo completado: ${enviados} enviados, ${errores} errores`);
  }
}
