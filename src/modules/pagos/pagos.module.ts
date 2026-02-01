import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pago } from '@entities/pago.entity';
import { Comprobante } from '@entities/comprobante.entity';
import { Mensualidad } from '@entities/mensualidad.entity';
import { Configuracion } from '@entities/configuracion.entity';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';
import { MensualidadesModule } from '../mensualidades/mensualidades.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pago, Comprobante, Mensualidad, Configuracion]),
    MensualidadesModule,
  ],
  controllers: [PagosController],
  providers: [PagosService],
  exports: [TypeOrmModule, PagosService],
})
export class PagosModule {}
