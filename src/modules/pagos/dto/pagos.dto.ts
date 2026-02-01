import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetodoPago } from '@entities/pago.entity';
import { PaginationDto } from '@common/dto/pagination.dto';
import { Type } from 'class-transformer';

// DTO para crear pago
export class CreatePagoDto {
  @ApiProperty({ description: 'ID de la mensualidad' })
  @IsNumber()
  @IsNotEmpty()
  mensualidad_id: number;

  @ApiProperty({ description: 'Monto pagado' })
  @IsNumber()
  @Min(0)
  monto_pagado: number;

  @ApiProperty({ enum: MetodoPago, description: 'Método de pago' })
  @IsEnum(MetodoPago)
  metodo_pago: MetodoPago;

  @ApiPropertyOptional({ description: 'Observaciones' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

// DTO para filtros
export class FilterPagoDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filtrar por jugador' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  jugador_id?: number;

  @ApiPropertyOptional({ enum: MetodoPago, description: 'Filtrar por método' })
  @IsOptional()
  @IsEnum(MetodoPago)
  metodo_pago?: MetodoPago;

  @ApiPropertyOptional({ description: 'Fecha desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fecha_hasta?: string;
}

// DTO para anular pago
export class AnularPagoDto {
  @ApiProperty({ description: 'Motivo de anulación' })
  @IsString()
  @IsNotEmpty()
  motivo: string;
}
