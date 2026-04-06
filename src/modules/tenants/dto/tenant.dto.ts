import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Pérez López' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({ example: 'juan.perez@email.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '+504 9999-8888' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiPropertyOptional({ example: '0801-1990-12345', description: 'Honduran ID or RTN number' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  idNumber?: string;

  @ApiPropertyOptional({ example: 'María López' })
  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: '+504 8888-7777' })
  @IsString()
  @IsOptional()
  emergencyPhone?: string;

  @ApiPropertyOptional({ example: 'Trabaja en empresa X, referencias verificadas' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}

export class TenantQueryDto {
  @ApiPropertyOptional({ example: 'Juan', description: 'Search by name, email, phone or ID number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number = 20;
}
