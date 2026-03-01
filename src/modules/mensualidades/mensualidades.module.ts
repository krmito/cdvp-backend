import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { Usuario } from '@entities/usuario.entity';
import { MensualidadesService } from './mensualidades.service';
import { MensualidadesCronService } from './mensualidades-cron.service';
import { MensualidadesController } from './mensualidades.controller';
import { MensajesModule } from '../mensajes/mensajes.module';
import { ReportesModule } from '../reportes/reportes.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mensualidad, Jugador, Configuracion, Usuario]),
    MensajesModule,
    ReportesModule,
  ],
  controllers: [MensualidadesController],
  providers: [MensualidadesService, MensualidadesCronService],
  exports: [TypeOrmModule, MensualidadesService],
})
export class MensualidadesModule {}
