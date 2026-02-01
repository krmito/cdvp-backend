import { IsNumber, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GenerarMensualidadesDto {
  @ApiPropertyOptional({
    description: 'Mes a generar (1-12). Si no se especifica, genera el mes actual',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  mes?: number;

  @ApiPropertyOptional({
    description: 'Año a generar. Si no se especifica, usa el anio actual',
    example: 2026,
  })
  @IsOptional()
  @IsNumber()
  @Min(2024)
  anio?: number;

  @ApiPropertyOptional({
    description: 'Fecha de vencimiento personalizada. Si no se especifica, será 30 días desde hoy',
    example: '2026-02-28',
  })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;
}

export class UpdateMensualidadDto {
  @ApiPropertyOptional({
    description: 'Nueva fecha de vencimiento',
    example: '2026-02-28',
  })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;
}
