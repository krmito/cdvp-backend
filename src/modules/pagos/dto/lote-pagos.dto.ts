import {
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MetodoPago } from '@entities/pago.entity';

export class InterpretarTextoDto {
  @ApiProperty({
    description: 'Texto copiado directamente del chat de WhatsApp',
    example: 'Juan David Caballero Sub 15 paga Agosto\nDilan Dominguez Sub 14 paga Agosto y $ 60.000 de Uniforme',
  })
  @IsString()
  @IsNotEmpty()
  texto: string;
}

export class ItemPagoLoteDto {
  @ApiPropertyOptional({ description: 'ID de la mensualidad' })
  @IsOptional()
  @IsNumber()
  mensualidad_id?: number;

  @ApiPropertyOptional({ description: 'Mes a pagar (si se crea bajo demanda)' })
  @IsOptional()
  @IsNumber()
  mes?: number;

  @ApiPropertyOptional({ description: 'Año a pagar (si se crea bajo demanda)' })
  @IsOptional()
  @IsNumber()
  anio?: number;

  @ApiProperty({ description: 'Monto pagado' })
  @IsNumber()
  @Min(0)
  monto_pagado: number;

  @ApiProperty({ enum: MetodoPago, description: 'Método de pago' })
  @IsEnum(MetodoPago)
  metodo_pago: MetodoPago;

  @ApiPropertyOptional({ description: 'Observaciones o conceptos adicionales' })
  @IsOptional()
  @IsString()
  observaciones?: string;

  @ApiPropertyOptional({ description: 'Ruta o nombre de archivo de comprobante ya subido' })
  @IsOptional()
  @IsString()
  comprobante_archivo?: string;

  @ApiPropertyOptional({ description: 'ID del jugador para referencia' })
  @IsOptional()
  @IsNumber()
  jugador_id?: number;
}

export class RegistrarLotePagosDto {
  @ApiProperty({ type: [ItemPagoLoteDto], description: 'Lista de pagos a registrar en lote' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPagoLoteDto)
  pagos: ItemPagoLoteDto[];
}
