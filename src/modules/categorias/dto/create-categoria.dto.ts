import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCategoriaDto {
  @ApiProperty({
    description: 'Nombre de la categoría',
    example: 'Pre-infantil',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Valor de la mensualidad',
    example: 40000,
  })
  @IsNumber()
  @Min(0)
  valor_mensualidad: number;

  @ApiPropertyOptional({
    description: 'Edad mínima',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  edad_minima?: number;

  @ApiPropertyOptional({
    description: 'Edad máxima',
    example: 8,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  edad_maxima?: number;

  @ApiPropertyOptional({
    description: 'Descripción de la categoría',
    example: 'Categoría para niños de 5 a 8 años',
  })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    description: 'Estado activo/inactivo',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
