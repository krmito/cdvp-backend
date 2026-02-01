import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class MensajesModule {}
// Este módulo está vacío - funcionalidad opcional para Fase 2
