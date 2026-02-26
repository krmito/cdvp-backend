import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcudienteJugador } from '@entities/acudiente-jugador.entity';
import { Jugador } from '@entities/jugador.entity';
import { Pago } from '@entities/pago.entity';
import { Comprobante } from '@entities/comprobante.entity';
import { Mensualidad } from '@entities/mensualidad.entity';
import { AcudienteService } from './acudiente.service';
import { AcudienteController } from './acudiente.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AcudienteJugador, Jugador, Pago, Comprobante, Mensualidad]),
  ],
  controllers: [AcudienteController],
  providers: [AcudienteService],
})
export class AcudienteModule {}
