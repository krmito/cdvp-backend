import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mensualidad, EstadoMensualidad } from '@entities/mensualidad.entity';
import { NotificacionesService } from './notificaciones.service';

@Injectable()
export class NotificacionesCronService {
  private readonly logger = new Logger(NotificacionesCronService.name);

  constructor(
    @InjectRepository(Mensualidad)
    private readonly mensualidadRepository: Repository<Mensualidad>,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'America/Bogota' })
  async enviarRecordatoriosVencimiento() {
    this.logger.log('Ejecutando cron de recordatorios de vencimiento...');

    try {
      // Calcular fecha = hoy + 2 días
      const hoy = new Date();
      const fechaObjetivo = new Date(
        Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 2),
      );
      const fechaStr = fechaObjetivo.toISOString().split('T')[0]; // YYYY-MM-DD

      // Buscar mensualidades con fecha_vencimiento = hoy + 2 días y estado PENDIENTE o PARCIAL
      const mensualidades = await this.mensualidadRepository
        .createQueryBuilder('mensualidad')
        .leftJoinAndSelect('mensualidad.jugador', 'jugador')
        .leftJoinAndSelect('jugador.categoria', 'categoria')
        .where('mensualidad.fecha_vencimiento = :fecha', { fecha: fechaStr })
        .andWhere('mensualidad.estado IN (:...estados)', {
          estados: [EstadoMensualidad.PENDIENTE, EstadoMensualidad.PARCIAL],
        })
        .getMany();

      if (mensualidades.length === 0) {
        this.logger.log('No hay mensualidades próximas a vencer en 2 días');
        return;
      }

      this.logger.log(`Encontradas ${mensualidades.length} mensualidades próximas a vencer`);

      for (const mensualidad of mensualidades) {
        try {
          await this.notificacionesService.enviarRecordatorioVencimiento(
            mensualidad.jugador,
            mensualidad,
          );
        } catch (error) {
          this.logger.error(
            `Error enviando recordatorio para mensualidad ${mensualidad.id}: ${error.message}`,
          );
        }
        // Delay entre envíos
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      this.logger.log('Cron de recordatorios finalizado');
    } catch (error) {
      this.logger.error(`Error en cron de recordatorios: ${error.message}`);
    }
  }
}
