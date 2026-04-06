import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PropertyType } from '../entities/property.entity';

export class CreatePropertyDto {
  @ApiProperty({ example: 'Edificio San Miguel' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Col. Palmira, Ave. República de Chile #1234' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Tegucigalpa' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiPropertyOptional({ example: 'Francisco Morazán' })
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional({ example: '11101' })
  @IsString()
  @IsOptional()
  zipCode?: string;

  @ApiPropertyOptional({ example: 14.0723 })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -87.1921 })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ enum: PropertyType, example: PropertyType.APARTMENT })
  @IsEnum(PropertyType)
  @IsOptional()
  type?: PropertyType;

  @ApiPropertyOptional({ example: 'Edificio de 3 pisos, cerca del mall' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class PropertyQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @ApiPropertyOptional({ example: 'Tegucigalpa' })
  @IsOptional()
  @IsString()
  city?: string;

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
