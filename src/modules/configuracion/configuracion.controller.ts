import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ConfiguracionService } from './configuracion.service';
import {
  CreateConfiguracionDto,
  UpdateConfiguracionDto,
} from './dto/configuracion.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@entities/usuario.entity';

@ApiTags('configuracion')
@ApiBearerAuth()
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly configuracionService: ConfiguracionService) {}

  @Post()
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Crear nueva configuración' })
  @ApiResponse({ status: 201, description: 'Configuración creada' })
  @ApiResponse({ status: 409, description: 'Clave ya existe' })
  create(@Body() createConfiguracionDto: CreateConfiguracionDto) {
    return this.configuracionService.create(createConfiguracionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las configuraciones' })
  @ApiResponse({ status: 200, description: 'Lista de configuraciones' })
  findAll() {
    return this.configuracionService.findAll();
  }

  @Get(':clave')
  @ApiOperation({ summary: 'Obtener una configuración por clave' })
  @ApiResponse({ status: 200, description: 'Configuración encontrada' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  findByClave(@Param('clave') clave: string) {
    return this.configuracionService.findByClave(clave);
  }

  @Patch(':clave')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar una configuración' })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  update(
    @Param('clave') clave: string,
    @Body() updateConfiguracionDto: UpdateConfiguracionDto,
  ) {
    return this.configuracionService.update(clave, updateConfiguracionDto);
  }

  @Delete(':clave')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Eliminar una configuración' })
  @ApiResponse({ status: 200, description: 'Configuración eliminada' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  remove(@Param('clave') clave: string) {
    return this.configuracionService.remove(clave);
  }
}
