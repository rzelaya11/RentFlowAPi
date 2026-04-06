import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { UnitStatus } from '../entities/unit.entity';

export class CreateUnitDto {
  @ApiProperty({ example: '101' })
  @IsString()
  @IsNotEmpty()
  unitNumber: string;

  @ApiPropertyOptional({ example: 'uuid-de-la-propiedad', description: 'Injected from URL when using nested route' })
  @IsUUID()
  @IsOptional()
  propertyId?: string;

  @ApiPropertyOptional({ example: 65.5, description: 'Area in square meters' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  areaSqm?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  bedrooms?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  bathrooms?: number;

  @ApiProperty({ example: 8500.00, description: 'Base rent in Lempiras' })
  @IsNumber()
  @Min(0)
  baseRent: number;

  @ApiPropertyOptional({ enum: UnitStatus, example: UnitStatus.AVAILABLE })
  @IsEnum(UnitStatus)
  @IsOptional()
  status?: UnitStatus;

  @ApiPropertyOptional({ example: 'Unidad con vista al parque, piso 1' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {}

export class UnitQueryDto {
  @ApiPropertyOptional({ description: 'Filter by property ID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ enum: UnitStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional({ example: '101', description: 'Search by unit number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
