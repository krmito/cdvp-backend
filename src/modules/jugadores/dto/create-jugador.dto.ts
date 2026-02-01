import {
  IsString,
  IsDateString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJugadorDto {
  @ApiProperty({
    description: 'Nombre del jugador',
    example: 'Juan',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;
  
  @ApiProperty({
    description: 'Apellido del jugador',
    example: 'Pérez García',
  })
  @IsString()
  @IsNotEmpty()
  apellido: string;

  @ApiPropertyOptional({
    description: 'Tipo de documento',
    example: 'TI',
    default: 'TI',
  })
  @IsOptional()
  @IsString()
  tipo_documento?: string;

  @ApiProperty({
    description: 'Número de documento',
    example: '1001001001',
  })
  @IsString()
  @IsNotEmpty()
  documento: string;

  @ApiProperty({
    description: 'Fecha de nacimiento',
    example: '2015-05-20',
  })
  @IsDateString()
  fecha_nacimiento: string;

  @ApiPropertyOptional({
    description: 'Dirección de residencia',
    example: 'Calle 10 #20-30',
  })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiProperty({
    description: 'Teléfono del jugador',
    example: '300-111-1111',
  })
  @IsString()
  @IsNotEmpty()
  telefono: string;

  @ApiPropertyOptional({
    description: 'Teléfono del acudiente',
    example: '321-222-2222',
  })
  @IsOptional()
  @IsString()
  telefono_acudiente?: string;

  @ApiPropertyOptional({
    description: 'Email',
    example: 'jugador@email.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'ID de la categoría',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  categoria_id: number;

  @ApiPropertyOptional({
    description: 'Posición en el campo',
    example: 'Delantero',
  })
  @IsOptional()
  @IsString()
  posicion?: string;

  @ApiPropertyOptional({
    description: 'Talla de camisa',
    example: 'M',
  })
  @IsOptional()
  @IsString()
  talla_camisa?: string;

  @ApiPropertyOptional({
    description: 'Día de vencimiento de mensualidad (1-31)',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  dia_vencimiento?: number;

  @ApiPropertyOptional({
    description: 'URL de la foto',
    example: '/uploads/fotos/jugador123.jpg',
  })
  @IsOptional()
  @IsString()
  foto_url?: string;

  @ApiPropertyOptional({
    description: 'Estado activo/inactivo',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
