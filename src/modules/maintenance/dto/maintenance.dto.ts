import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { MaintenancePriority, MaintenanceStatus } from '../entities/maintenance-request.entity';

export class CreateMaintenanceDto {
  @ApiProperty({ example: 'uuid-de-la-unidad' })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiPropertyOptional({ example: 'uuid-del-inquilino', description: 'Tenant who reported the issue (optional)' })
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({ example: 'Fuga de agua en baño principal' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'El grifo del lavabo tiene una fuga constante que moja el gabinete.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ enum: MaintenancePriority, default: MaintenancePriority.MEDIUM })
  @IsEnum(MaintenancePriority)
  @IsOptional()
  priority?: MaintenancePriority;

  @ApiPropertyOptional({ example: 850.00, description: 'Estimated repair cost in Lempiras' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedCost?: number;
}

export class UpdateMaintenanceDto extends PartialType(
  OmitType(CreateMaintenanceDto, ['unitId'] as const),
) {}

export class ChangeMaintenanceStatusDto {
  @ApiProperty({ enum: MaintenanceStatus, example: MaintenanceStatus.IN_PROGRESS })
  @IsEnum(MaintenanceStatus)
  status: MaintenanceStatus;

  @ApiPropertyOptional({ example: 'Se reemplazó el grifo. Costo final: L. 920.' })
  @IsString()
  @IsOptional()
  resolutionNotes?: string;

  @ApiPropertyOptional({ example: 920.00, description: 'Actual cost of the repair in Lempiras' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  actualCost?: number;
}

export class MaintenanceQueryDto {
  @ApiPropertyOptional({ description: 'Filter by unit ID' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Filter by tenant ID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Filter by property ID' })
  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @ApiPropertyOptional({ enum: MaintenanceStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ enum: MaintenancePriority, description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(MaintenancePriority)
  priority?: MaintenancePriority;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
