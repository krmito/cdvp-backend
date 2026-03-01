import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario, UserRole } from '@entities/usuario.entity';
import { MensualidadesService } from './mensualidades.service';
import { NotificacionesService } from '../mensajes/notificaciones.service';
import { ReportesService } from '../reportes/reportes.service';
import { getNowBogota } from '@common/utils/date.utils';

@Injectable()
export class MensualidadesCronService {
  private readonly logger = new Logger(MensualidadesCronService.name);

  constructor(
    private readonly mensualidadesService: MensualidadesService,
    private readonly notificacionesService: NotificacionesService,
    private readonly reportesService: ReportesService,
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  @Cron('0 8 1 * *', { name: 'auto-generar-mensualidades', timeZone: 'America/Bogota' })
  async autoGenerarMensualidades() {
    this.logger.log('Ejecutando cron de auto-generación de mensualidades...');

    try {
      const hoy = getNowBogota();
      const mes = hoy.getMonth() + 1;
      const anio = hoy.getFullYear();

      const resultado = await this.mensualidadesService.generarMensualidades({ mes, anio });

      if (resultado.generadas > 0) {
        this.logger.log(`Auto-generación: ${resultado.generadas} mensualidades creadas para ${mes}/${anio}`);

        // Notificar a los admins
        const admins = await this.usuarioRepository.find({
          where: { rol: UserRole.ADMINISTRADOR, activo: true },
        });

        if (admins.length > 0) {
          const emails = admins.map((admin) => admin.email);
          await this.notificacionesService.enviarNotificacionAutoGeneracion(
            emails,
            resultado.generadas,
            mes,
            anio,
          );
          this.logger.log(`Notificación de auto-generación enviada a ${emails.length} admin(es)`);
        }
      } else {
        this.logger.log(`Auto-generación: las mensualidades de ${mes}/${anio} ya estaban generadas`);
      }
    } catch (error) {
      this.logger.error(`Error en cron de auto-generación de mensualidades: ${error.message}`);
    }
  }

  // Dispara el día 1 de cada mes a las 7:00 AM hora Colombia, antes de la auto-generación (8:00 AM)
  @Cron('0 7 1 * *', { name: 'resumen-mensual-admins', timeZone: 'America/Bogota' })
  async enviarResumenMensualAdmins() {
    this.logger.log('Ejecutando cron de resumen mensual para administradores...');

    try {
      // El día 1, el mes anterior es el que acabó de cerrar
      const hoy = getNowBogota();
      const mesCierre = hoy.getMonth() === 0 ? 12 : hoy.getMonth();
      const anioCierre = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();

      this.logger.log(`Generando resumen de ${mesCierre}/${anioCierre}`);

      // Obtener datos del mes cerrado en paralelo
      const [resumen, porCategoria, morosos, admins] = await Promise.all([
        this.mensualidadesService.getResumenMes(mesCierre, anioCierre),
        this.reportesService.cumplimientoPorCategoria(mesCierre, anioCierre),
        this.reportesService.reporteMorosos(),
        this.usuarioRepository.find({
          where: { rol: UserRole.ADMINISTRADOR, activo: true },
        }),
      ]);

      if (admins.length === 0) {
        this.logger.warn('No hay administradores activos para enviar el resumen mensual');
        return;
      }

      const emails = admins.map((a) => a.email);

      await this.notificacionesService.enviarResumenMensual(emails, {
        mes: mesCierre,
        anio: anioCierre,
        totalEsperado: resumen.total_esperado,
        totalRecaudado: resumen.total_recaudado,
        totalPendiente: resumen.total_pendiente,
        porcentajeCumplimiento: resumen.porcentaje_recaudo,
        totalMensualidades: resumen.total_mensualidades,
        pagadas: resumen.pagadas,
        pendientes: resumen.pendientes,
        vencidas: resumen.vencidas,
        parciales: resumen.parciales,
        totalMorosos: morosos.total_morosos,
        deudaTotal: morosos.deuda_total,
        categorias: porCategoria.categorias,
      });

      this.logger.log(`Resumen mensual ${mesCierre}/${anioCierre} enviado a ${emails.length} administrador(es)`);
    } catch (error) {
      this.logger.error(`Error en cron de resumen mensual: ${error.message}`);
    }
  }
}
