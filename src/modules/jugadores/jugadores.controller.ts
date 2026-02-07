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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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

  @Post(':id/foto')
  @Roles(UserRole.ADMINISTRADOR, UserRole.TESORERO)
  @ApiOperation({ summary: 'Subir foto de perfil del jugador' })
  @ApiResponse({ status: 200, description: 'Foto actualizada' })
  @ApiResponse({ status: 400, description: 'Archivo inválido' })
  @ApiResponse({ status: 404, description: 'Jugador no encontrado' })
  @UseInterceptors(
    FileInterceptor('foto', {
      storage: diskStorage({
        destination: './uploads/jugadores',
        filename: (req, file, cb) => {
          const id = req.params.id;
          const timestamp = Date.now();
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${id}-${timestamp}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
          cb(new BadRequestException('Solo se permiten archivos JPG y PNG'), false);
          return;
        }
        cb(null, true);
      },
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
    }),
  )
  subirFoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No se envió ningún archivo');
    }
    return this.jugadoresService.subirFoto(id, file);
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
