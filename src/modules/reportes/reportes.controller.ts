import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportesService } from './reportes.service';

@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Get('caja')
  @ApiOperation({ summary: 'Reporte de caja por período o mes/año de mensualidad' })
  @ApiQuery({ name: 'fechaInicio', example: '2026-01-01', required: false })
  @ApiQuery({ name: 'fechaFin', example: '2026-01-31', required: false })
  @ApiQuery({ name: 'mes', example: 1, required: false })
  @ApiQuery({ name: 'anio', example: 2026, required: false })
  @ApiQuery({
    name: 'agruparPor',
    enum: ['dia', 'metodo'],
    required: false,
  })
  @ApiResponse({ status: 200, description: 'Reporte de caja' })
  reporteCaja(
    @Query('fechaInicio') fechaInicio: string,
    @Query('fechaFin') fechaFin: string,
    @Query('agruparPor') agruparPor: 'dia' | 'metodo' = 'dia',
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
  ) {
    const mesNum = mes ? parseInt(mes) : undefined;
    const anioNum = anio ? parseInt(anio) : undefined;
    return this.reportesService.reporteCaja(fechaInicio, fechaFin, agruparPor, mesNum, anioNum);
  }

  @Get('morosos')
  @ApiOperation({ summary: 'Reporte de jugadores morosos' })
  @ApiQuery({ name: 'mes', example: 1, required: false })
  @ApiQuery({ name: 'anio', example: 2026, required: false })
  @ApiQuery({ name: 'categoriaId', example: 1, required: false })
  @ApiResponse({ status: 200, description: 'Lista de morosos' })
  reporteMorosos(
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
    @Query('categoriaId') categoriaId?: string,
  ) {
    const mesNum = mes ? parseInt(mes) : undefined;
    const anioNum = anio ? parseInt(anio) : undefined;
    const categoriaIdNum = categoriaId ? parseInt(categoriaId) : undefined;
    return this.reportesService.reporteMorosos(mesNum, anioNum, categoriaIdNum);
  }

  @Get('proyeccion-ingresos')
  @ApiOperation({ summary: 'Proyección de ingresos mensual' })
  @ApiQuery({ name: 'mes', example: 1 })
  @ApiQuery({ name: 'anio', example: 2026 })
  @ApiResponse({ status: 200, description: 'Proyección de ingresos' })
  proyeccionIngresos(
    @Query('mes', ParseIntPipe) mes: number,
    @Query('anio', ParseIntPipe) anio: number,
  ) {
    return this.reportesService.proyeccionIngresos(mes, anio);
  }

  @Get('cumplimiento-categoria')
  @ApiOperation({ summary: 'Cumplimiento de pago por categoría' })
  @ApiQuery({ name: 'mes', example: 1 })
  @ApiQuery({ name: 'anio', example: 2026 })
  @ApiResponse({ status: 200, description: 'Cumplimiento por categoría' })
  cumplimientoPorCategoria(
    @Query('mes', ParseIntPipe) mes: number,
    @Query('anio', ParseIntPipe) anio: number,
  ) {
    return this.reportesService.cumplimientoPorCategoria(mes, anio);
  }

  @Get('estadisticas-generales')
  @ApiOperation({ summary: 'Estadísticas generales del sistema' })
  @ApiResponse({ status: 200, description: 'Estadísticas generales' })
  estadisticasGenerales() {
    return this.reportesService.estadisticasGenerales();
  }

  @Get('posibles-inactivos')
  @ApiOperation({ summary: 'Reporte de posibles jugadores inactivos por meses consecutivos sin pagar' })
  @ApiQuery({ name: 'mesesConsecutivos', example: 3, required: false })
  @ApiQuery({ name: 'categoriaId', example: 1, required: false })
  @ApiQuery({ name: 'busqueda', example: 'Mina', required: false })
  @ApiResponse({ status: 200, description: 'Lista de posibles jugadores inactivos detectados' })
  reportePosiblesInactivos(
    @Query('mesesConsecutivos') mesesConsecutivos?: string,
    @Query('categoriaId') categoriaId?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    const meses = mesesConsecutivos ? parseInt(mesesConsecutivos) : 3;
    const catId = categoriaId ? parseInt(categoriaId) : undefined;
    return this.reportesService.reportePosiblesInactivos(meses, catId, busqueda);
  }
}
