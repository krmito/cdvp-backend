import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AcudienteService } from './acudiente.service';
import { Roles } from '@common/decorators/roles.decorator';
import { GetUser } from '@common/decorators/get-user.decorator';
import { UserRole, Usuario } from '@entities/usuario.entity';

@ApiTags('acudiente')
@ApiBearerAuth()
@Roles(UserRole.ACUDIENTE)
@Controller('acudiente')
export class AcudienteController {
  constructor(private readonly acudienteService: AcudienteService) {}

  @Get('mis-hijos')
  @ApiOperation({ summary: 'Listar jugadores vinculados al acudiente' })
  getMisHijos(@GetUser() user: Usuario) {
    return this.acudienteService.getMisHijos(user.id);
  }

  @Get('hijos/:jugadorId/historial')
  @ApiOperation({ summary: 'Historial de mensualidades y pagos de un hijo' })
  getHijoHistorial(
    @GetUser() user: Usuario,
    @Param('jugadorId', ParseIntPipe) jugadorId: number,
  ) {
    return this.acudienteService.getHijoHistorial(user.id, jugadorId);
  }

  @Get('hijos/:jugadorId/pagos/:pagoId/recibo-pdf')
  @ApiOperation({ summary: 'Descargar recibo PDF de un pago' })
  async getReciboPdf(
    @GetUser() user: Usuario,
    @Param('jugadorId', ParseIntPipe) jugadorId: number,
    @Param('pagoId', ParseIntPipe) pagoId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.acudienteService.generarReciboPdf(
      user.id,
      jugadorId,
      pagoId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recibo-${pagoId}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }

  @Get('hijos/:jugadorId/pagos/:pagoId/comprobantes/:comprobanteId/download')
  @ApiOperation({ summary: 'Descargar comprobante de un pago' })
  async downloadComprobante(
    @GetUser() user: Usuario,
    @Param('jugadorId', ParseIntPipe) jugadorId: number,
    @Param('pagoId', ParseIntPipe) pagoId: number,
    @Param('comprobanteId', ParseIntPipe) comprobanteId: number,
    @Res() res: Response,
  ) {
    const comprobante = await this.acudienteService.getComprobante(
      user.id,
      jugadorId,
      pagoId,
      comprobanteId,
    );

    const buffer = Buffer.from(comprobante.contenido_base64, 'base64');
    res.setHeader('Content-Type', comprobante.tipo_archivo);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${comprobante.nombre_archivo}"`,
    );
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
