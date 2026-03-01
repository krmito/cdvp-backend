import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario, UserRole } from '@entities/usuario.entity';
import { MensualidadesService } from './mensualidades.service';
import { NotificacionesService } from '../mensajes/notificaciones.service';
import { getNowBogota } from '@common/utils/date.utils';

@Injectable()
export class MensualidadesCronService {
  private readonly logger = new Logger(MensualidadesCronService.name);

  constructor(
    private readonly mensualidadesService: MensualidadesService,
    private readonly notificacionesService: NotificacionesService,
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
}
