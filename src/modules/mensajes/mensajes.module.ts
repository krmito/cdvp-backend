import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Usuario } from '@entities/usuario.entity';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionesCronService } from './notificaciones-cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Mensualidad, Usuario]),
  ],
  providers: [NotificacionesService, NotificacionesCronService],
  exports: [NotificacionesService],
})
export class MensajesModule {}
