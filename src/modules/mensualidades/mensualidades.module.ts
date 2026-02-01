import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { MensualidadesService } from './mensualidades.service';
import { MensualidadesController } from './mensualidades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mensualidad, Jugador, Configuracion])],
  controllers: [MensualidadesController],
  providers: [MensualidadesService],
  exports: [TypeOrmModule, MensualidadesService],
})
export class MensualidadesModule {}
