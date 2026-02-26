import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePermisosRolDto {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  puede_ver?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  puede_crear?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  puede_editar?: boolean;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  puede_eliminar?: boolean;
}
