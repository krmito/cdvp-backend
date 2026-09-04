import { IsArray, IsInt, IsOptional, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DesactivarLoteJugadoresDto {
  @ApiProperty({
    description: 'Lista de IDs de jugadores a desactivar',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos un jugador para desactivar' })
  @IsInt({ each: true, message: 'Cada ID de jugador debe ser un número entero' })
  jugadorIds: number[];

  @ApiPropertyOptional({
    description: 'Motivo opcional de la desactivación',
    example: 'Inactividad por 3 o más meses consecutivos sin pago',
  })
  @IsOptional()
  @IsString()
  motivo?: string;
}
