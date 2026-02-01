import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pago } from '@entities/pago.entity';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Jugador } from '@entities/jugador.entity';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pago, Mensualidad, Jugador])],
  controllers: [ReportesController],
  providers: [ReportesService],
  exports: [TypeOrmModule, ReportesService],
})
export class ReportesModule {}
