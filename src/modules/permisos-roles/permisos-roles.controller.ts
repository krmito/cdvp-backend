import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PermisosRolesService } from './permisos-roles.service';
import { UpdatePermisosRolDto } from './dto/update-permisos-rol.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetUser } from '@common/decorators/get-user.decorator';
import { Usuario, UserRole } from '@entities/usuario.entity';

@ApiTags('permisos-roles')
@ApiBearerAuth()
@Controller('permisos-roles')
export class PermisosRolesController {
  constructor(private readonly permisosRolesService: PermisosRolesService) {}

  @Get()
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Obtener todos los permisos (solo admin)' })
  @ApiResponse({ status: 200, description: 'Lista de permisos por rol' })
  findAll() {
    return this.permisosRolesService.findAll();
  }

  @Get('mis-permisos')
  @ApiOperation({ summary: 'Obtener permisos del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Permisos del usuario actual' })
  getMisPermisos(@GetUser() user: Usuario) {
    return this.permisosRolesService.findMisPermisos(user.rol);
  }

  @Post('inicializar')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Inicializar/restaurar permisos por defecto' })
  @ApiResponse({ status: 201, description: 'Permisos inicializados' })
  inicializar() {
    return this.permisosRolesService.inicializar();
  }

  @Patch(':rol/:modulo')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar permiso de un rol para un módulo' })
  @ApiResponse({ status: 200, description: 'Permiso actualizado' })
  @ApiResponse({ status: 404, description: 'Permiso no encontrado' })
  update(
    @Param('rol') rol: UserRole,
    @Param('modulo') modulo: string,
    @Body() dto: UpdatePermisosRolDto,
  ) {
    return this.permisosRolesService.update(rol, modulo, dto);
  }
}
