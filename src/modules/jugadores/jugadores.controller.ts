import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JugadoresService } from './jugadores.service';
import { CreateJugadorDto } from './dto/create-jugador.dto';
import { UpdateJugadorDto } from './dto/update-jugador.dto';
import { FilterJugadorDto } from './dto/filter-jugador.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@entities/usuario.entity';

@ApiTags('jugadores')
@ApiBearerAuth()
@Controller('jugadores')
export class JugadoresController {
  constructor(private readonly jugadoresService: JugadoresService) {}

  @Post()
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Registrar nuevo jugador' })
  @ApiResponse({ status: 201, description: 'Jugador registrado' })
  @ApiResponse({ status: 409, description: 'Documento ya existe' })
  create(@Body() createJugadorDto: CreateJugadorDto) {
    return this.jugadoresService.create(createJugadorDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los jugadores con filtros' })
  @ApiResponse({ status: 200, description: 'Lista de jugadores' })
  findAll(@Query() filterDto: FilterJugadorDto) {
    return this.jugadoresService.findAll(filterDto);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de jugadores' })
  @ApiResponse({ status: 200, description: 'Estadísticas' })
  getStats() {
    return this.jugadoresService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un jugador por ID' })
  @ApiResponse({ status: 200, description: 'Jugador encontrado' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jugadoresService.findOne(id);
  }

  @Get('documento/:documento')
  @ApiOperation({ summary: 'Obtener jugador por documento' })
  @ApiResponse({ status: 200, description: 'Jugador encontrado' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  findByDocumento(@Param('documento') documento: string) {
    return this.jugadoresService.findByDocumento(documento);
  }

  @Get(':id/historial-pagos')
  @ApiOperation({ summary: 'Obtener historial de pagos del jugador' })
  @ApiResponse({ status: 200, description: 'Historial de pagos' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  getHistorialPagos(@Param('id', ParseIntPipe) id: number) {
    return this.jugadoresService.getHistorialPagos(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Actualizar un jugador' })
  @ApiResponse({ status: 200, description: 'Jugador actualizado' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateJugadorDto: UpdateJugadorDto,
  ) {
    return this.jugadoresService.update(id, updateJugadorDto);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar/Desactivar jugador' })
  @ApiResponse({ status: 200, description: 'Estado cambiado' })
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.jugadoresService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Eliminar un jugador' })
  @ApiResponse({ status: 200, description: 'Jugador eliminado' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.jugadoresService.remove(id);
  }
}
