import { IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '@common/dto/pagination.dto';
import { EstadoMensualidad } from '@entities/mensualidad.entity';

export class FilterMensualidadDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por jugador',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  jugador_id?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por mes',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mes?: number;

  @ApiPropertyOptional({
    description: 'Filtrar por anio',
    example: 2026,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  anio?: number;

  @ApiPropertyOptional({
    enum: EstadoMensualidad,
    description: 'Filtrar por estado',
    example: EstadoMensualidad.PENDIENTE,
  })
  @IsOptional()
  @IsEnum(EstadoMensualidad)
  estado?: EstadoMensualidad;
}
