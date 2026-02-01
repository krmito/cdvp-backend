import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { Roles } from '@common/decorators/roles.decorator';
import { UserRole } from '@entities/usuario.entity';

@ApiTags('staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Registrar nuevo miembro del staff' })
  @ApiResponse({ status: 201, description: 'Staff registrado' })
  create(@Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(createStaffDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todo el staff activo' })
  @ApiResponse({ status: 200, description: 'Lista de staff' })
  findAll() {
    return this.staffService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un miembro del staff por ID' })
  @ApiResponse({ status: 200, description: 'Staff encontrado' })
  @ApiResponse({ status: 404, description: 'Staff no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Actualizar miembro del staff' })
  @ApiResponse({ status: 200, description: 'Staff actualizado' })
  @ApiResponse({ status: 404, description: 'Staff no encontrado' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStaffDto: UpdateStaffDto,
  ) {
    return this.staffService.update(id, updateStaffDto);
  }

  @Patch(':id/toggle-active')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Activar/Desactivar staff' })
  @ApiResponse({ status: 200, description: 'Estado cambiado' })
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Eliminar miembro del staff' })
  @ApiResponse({ status: 200, description: 'Staff eliminado' })
  @ApiResponse({ status: 404, description: 'Staff no encontrado' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.staffService.remove(id);
  }
}
