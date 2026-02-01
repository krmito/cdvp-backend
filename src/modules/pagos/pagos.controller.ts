import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { PagosService } from './pagos.service';
import { CreatePagoDto, FilterPagoDto, AnularPagoDto } from './dto/pagos.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { GetUser } from '@common/decorators/get-user.decorator';
import { UserRole, Usuario } from '@entities/usuario.entity';

@ApiTags('pagos')
@ApiBearerAuth()
@Controller('pagos')
export class PagosController {
  constructor(private readonly pagosService: PagosService) {}

  @Post()
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Registrar nuevo pago' })
  @ApiResponse({ status: 201, description: 'Pago registrado' })
  create(@Body() createPagoDto: CreatePagoDto, @GetUser() usuario: Usuario) {
    return this.pagosService.create(createPagoDto, usuario);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los pagos con filtros' })
  @ApiResponse({ status: 200, description: 'Lista de pagos' })
  findAll(@Query() filterDto: FilterPagoDto) {
    return this.pagosService.findAll(filterDto);
  }

  @Get('por-fecha/:fecha')
  @ApiOperation({ summary: 'Obtener pagos por fecha' })
  @ApiResponse({ status: 200, description: 'Pagos del día' })
  getPorFecha(@Param('fecha') fecha: string) {
    return this.pagosService.getPorFecha(fecha);
  }

  @Get('por-metodo/:metodo')
  @ApiOperation({ summary: 'Obtener pagos por método' })
  @ApiResponse({ status: 200, description: 'Pagos por método' })
  getPorMetodo(@Param('metodo') metodo: string) {
    return this.pagosService.getPorMetodo(metodo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un pago por ID' })
  @ApiResponse({ status: 200, description: 'Pago encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pagosService.findOne(id);
  }

  @Delete(':id/anular')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Anular un pago' })
  @ApiResponse({ status: 200, description: 'Pago anulado' })
  anular(
    @Param('id', ParseIntPipe) id: number,
    @Body() anularDto: AnularPagoDto,
    @GetUser() usuario: Usuario,
  ) {
    return this.pagosService.anular(id, anularDto, usuario);
  }

  @Post(':id/comprobante')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Subir comprobante de pago' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Comprobante subido' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Solo se permiten archivos JPG, PNG o PDF'), false);
        }
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadComprobante(
    @Param('id', ParseIntPipe) pagoId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.pagosService.guardarComprobante(pagoId, file);
  }

  @Get('comprobante/:id/download')
  @ApiOperation({ summary: 'Descargar comprobante' })
  @ApiResponse({ status: 200, description: 'Archivo del comprobante' })
  async downloadComprobante(
    @Param('id', ParseIntPipe) comprobanteId: number,
    @Res() res: Response,
  ) {
    const comprobante = await this.pagosService.getComprobante(comprobanteId);

    // Convertir base64 a buffer
    const fileBuffer = Buffer.from(comprobante.contenido_base64, 'base64');

    // Establecer headers para la descarga
    res.setHeader('Content-Type', comprobante.tipo_archivo);
    res.setHeader('Content-Disposition', `attachment; filename="${comprobante.nombre_archivo}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    res.send(fileBuffer);
  }
}
