import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermisosRol } from '@entities/permisos-rol.entity';
import { PermisosRolesService } from './permisos-roles.service';
import { PermisosRolesController } from './permisos-roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PermisosRol])],
  controllers: [PermisosRolesController],
  providers: [PermisosRolesService],
  exports: [PermisosRolesService],
})
export class PermisosRolesModule {}
