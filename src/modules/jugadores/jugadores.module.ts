import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Jugador } from '@entities/jugador.entity';
import { Categoria } from '@entities/categoria.entity';
import { JugadoresService } from './jugadores.service';
import { JugadoresController } from './jugadores.controller';
import { MensualidadesModule } from '../mensualidades/mensualidades.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Jugador, Categoria]),
    MensualidadesModule,
  ],
  controllers: [JugadoresController],
  providers: [JugadoresService],
  exports: [TypeOrmModule, JugadoresService],
})
export class JugadoresModule {}
