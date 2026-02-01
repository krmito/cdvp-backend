import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TipoConfiguracion {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
}

export class CreateConfiguracionDto {
  @ApiProperty({ description: 'Clave única', example: 'dias_tolerancia' })
  @IsString()
  @IsNotEmpty()
  clave: string;

  @ApiProperty({ description: 'Valor de la configuración', example: '5' })
  @IsString()
  @IsNotEmpty()
  valor: string;

  @ApiPropertyOptional({
    enum: TipoConfiguracion,
    description: 'Tipo de dato',
    example: TipoConfiguracion.NUMBER,
  })
  @IsOptional()
  @IsEnum(TipoConfiguracion)
  tipo?: string;

  @ApiPropertyOptional({ description: 'Descripción', example: 'Días de tolerancia para pago' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class UpdateConfiguracionDto {
  @ApiProperty({ description: 'Nuevo valor', example: '7' })
  @IsString()
  @IsNotEmpty()
  valor: string;
}
