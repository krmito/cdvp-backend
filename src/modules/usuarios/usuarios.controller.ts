import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Delete,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { RegisterDto } from '../auth/dto/register.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@entities/usuario.entity';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 409, description: 'Email o usuario ya existe' })
  create(@Body() registerDto: RegisterDto) {
    return this.usuariosService.create(registerDto);
  }

  @Get()
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Patch(':id/cambiar-rol')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cambiar rol de un usuario' })
  @ApiResponse({ status: 200, description: 'Rol actualizado' })
  cambiarRol(
    @Param('id', ParseIntPipe) id: number,
    @Body('rol') rol: UserRole,
  ) {
    return this.usuariosService.cambiarRol(id, rol);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar/Desactivar usuario' })
  @ApiResponse({ status: 200, description: 'Estado cambiado' })
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Eliminar un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.remove(id);
  }

  @Get(':id/jugadores')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Obtener jugadores vinculados a un acudiente' })
  @ApiResponse({ status: 200, description: 'Lista de jugadores' })
  getJugadoresVinculados(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.getJugadoresVinculados(id);
  }

  @Post(':id/vincular-jugador')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Vincular jugador a un acudiente' })
  @ApiResponse({ status: 201, description: 'Jugador vinculado' })
  @ApiResponse({ status: 409, description: 'Jugador ya vinculado' })
  vincularJugador(
    @Param('id', ParseIntPipe) id: number,
    @Body('jugador_id') jugadorId: number,
  ) {
    return this.usuariosService.vincularJugador(id, jugadorId);
  }

  @Delete(':id/jugadores/:jugadorId')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Desvincular jugador de un acudiente' })
  @ApiResponse({ status: 200, description: 'Jugador desvinculado' })
  desvincularJugador(
    @Param('id', ParseIntPipe) id: number,
    @Param('jugadorId', ParseIntPipe) jugadorId: number,
  ) {
    return this.usuariosService.desvincularJugador(id, jugadorId);
  }
}
