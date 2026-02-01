import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Patch,
  Delete,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MensualidadesService } from './mensualidades.service';
import { GenerarMensualidadesDto, UpdateMensualidadDto } from './dto/generar-mensualidades.dto';
import { FilterMensualidadDto } from './dto/filter-mensualidad.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@entities/usuario.entity';

@ApiTags('mensualidades')
@ApiBearerAuth()
@Controller('mensualidades')
export class MensualidadesController {
  constructor(private readonly mensualidadesService: MensualidadesService) {}

  @Post('generar')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Generar mensualidades para un mes' })
  @ApiResponse({ status: 201, description: 'Mensualidades generadas' })
  @ApiResponse({ status: 409, description: 'Ya existen mensualidades' })
  generar(@Body() dto: GenerarMensualidadesDto) {
    return this.mensualidadesService.generarMensualidades(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las mensualidades con filtros' })
  @ApiResponse({ status: 200, description: 'Lista de mensualidades' })
  findAll(@Query() filterDto: FilterMensualidadDto) {
    return this.mensualidadesService.findAll(filterDto);
  }

  @Get('vencidas')
  @ApiOperation({ summary: 'Obtener mensualidades vencidas' })
  @ApiResponse({ status: 200, description: 'Lista de mensualidades vencidas' })
  findVencidas() {
    return this.mensualidadesService.findVencidas();
  }

  @Get('resumen/:mes/:anio')
  @ApiOperation({ summary: 'Obtener resumen de un mes específico' })
  @ApiResponse({ status: 200, description: 'Resumen del mes' })
  getResumenMes(
    @Param('mes', ParseIntPipe) mes: number,
    @Param('anio', ParseIntPipe) anio: number,
  ) {
    return this.mensualidadesService.getResumenMes(mes, anio);
  }

  @Get('jugador/:jugadorId')
  @ApiOperation({ summary: 'Obtener mensualidades de un jugador' })
  @ApiResponse({ status: 200, description: 'Mensualidades del jugador' })
  findByJugador(@Param('jugadorId', ParseIntPipe) jugadorId: number) {
    return this.mensualidadesService.findByJugador(jugadorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una mensualidad por ID' })
  @ApiResponse({ status: 200, description: 'Mensualidad encontrada' })
  @ApiResponse({ status: 404, description: 'Mensualidad no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mensualidadesService.findOne(id);
  }

  @Patch('actualizar-estados')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Actualizar estados de mensualidades vencidas' })
  @ApiResponse({ status: 200, description: 'Estados actualizados' })
  actualizarEstados() {
    return this.mensualidadesService.actualizarEstados();
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Actualizar una mensualidad' })
  @ApiResponse({ status: 200, description: 'Mensualidad actualizada' })
  @ApiResponse({ status: 404, description: 'Mensualidad no encontrada' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMensualidadDto,
  ) {
    return this.mensualidadesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Eliminar una mensualidad pendiente' })
  @ApiResponse({ status: 200, description: 'Mensualidad eliminada' })
  @ApiResponse({ status: 400, description: 'No se puede eliminar (tiene pagos)' })
  @ApiResponse({ status: 404, description: 'Mensualidad no encontrada' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.mensualidadesService.delete(id);
  }
}
