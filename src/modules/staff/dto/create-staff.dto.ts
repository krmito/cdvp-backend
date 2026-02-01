import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RolStaff } from '@entities/staff.entity';

export class CreateStaffDto {
  @ApiProperty({ description: 'Nombre completo', example: 'Pedro Martínez' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiPropertyOptional({ description: 'Documento', example: '12345678' })
  @IsOptional()
  @IsString()
  documento?: string;

  @ApiProperty({ description: 'Teléfono', example: '321-111-1111' })
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @ApiPropertyOptional({ description: 'Email', example: 'pedro@club.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Rol del staff',
    enum: RolStaff,
    example: RolStaff.ENTRENADOR,
  })
  @IsEnum(RolStaff)
  @IsNotEmpty()
  rol: RolStaff;

  @ApiPropertyOptional({
    description: 'IDs de categorías asignadas',
    example: [1, 2],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  categorias_asignadas?: number[];

  @ApiPropertyOptional({
    description: 'Fecha de ingreso',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  fecha_ingreso?: Date;
}
