import { PartialType } from '@nestjs/swagger';
import { CreateStaffDto } from './create-staff.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateStaffDto extends PartialType(CreateStaffDto) {
  @ApiPropertyOptional({ description: 'Estado activo', example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
