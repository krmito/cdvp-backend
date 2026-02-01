import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    description: 'Usuario o email',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @ApiProperty({
    description: 'Contraseña',
    example: 'Admin123!',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
