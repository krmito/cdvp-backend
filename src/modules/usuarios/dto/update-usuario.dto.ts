import { IsString, IsEmail, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@entities/usuario.entity';

export class UpdateUsuarioDto {
  @ApiPropertyOptional({ description: 'Nombre completo' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'Email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Rol del usuario' })
  @IsOptional()
  @IsEnum(UserRole)
  rol?: UserRole;

  @ApiPropertyOptional({ description: 'Estado activo' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
