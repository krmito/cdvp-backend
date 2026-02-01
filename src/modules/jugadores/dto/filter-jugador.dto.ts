import { IsOptional, IsString, IsNumber, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';

export class FilterJugadorDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Buscar por nombre o documento',
    example: 'Juan',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por categoría',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoria_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por estado activo',
    example: true,
  })
  @IsOptional()
  @IsString()
  activo?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por posición',
    example: 'Delantero',
  })
  @IsOptional()
  @IsString()
  posicion?: string;
}
