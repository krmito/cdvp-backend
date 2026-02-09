import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BulkImportRowDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El apellido es obligatorio' })
  apellido: string;

  @IsString()
  @IsNotEmpty({ message: 'El documento es obligatorio' })
  documento: string;

  @IsString()
  @IsNotEmpty({ message: 'La fecha de nacimiento es obligatoria' })
  fecha_nacimiento: string;

  @IsString()
  @IsNotEmpty({ message: 'El telefono es obligatorio' })
  telefono: string;

  @IsString()
  @IsNotEmpty({ message: 'La categoria es obligatoria' })
  categoria: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  tipo_documento?: string;

  @IsOptional()
  @IsString()
  telefono_acudiente?: string;

  @IsOptional()
  @IsString()
  posicion?: string;

  @IsOptional()
  @IsString()
  talla_camisa?: string;
}

export class BulkImportJugadorDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'Debe enviar al menos un jugador' })
  @ArrayMaxSize(500, { message: 'Maximo 500 jugadores por importacion' })
  @Type(() => BulkImportRowDto)
  jugadores: BulkImportRowDto[];
}
