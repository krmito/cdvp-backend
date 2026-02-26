import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from '@entities/usuario.entity';
import { AcudienteJugador } from '@entities/acudiente-jugador.entity';
import { Jugador } from '@entities/jugador.entity';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, AcudienteJugador, Jugador])],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [TypeOrmModule, UsuariosService],
})
export class UsuariosModule {}
