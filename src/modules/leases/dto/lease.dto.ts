import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsDateString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LeaseStatus } from '../entities/lease.entity';

export class CreateLeaseDto {
  @ApiProperty({ example: 'uuid-de-la-unidad' })
  @IsUUID()
  @IsNotEmpty()
  unitId: string;

  @ApiProperty({ example: 'uuid-del-inquilino' })
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty({ example: '2026-04-01', description: 'Lease start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-03-31', description: 'Lease end date (YYYY-MM-DD)' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 8500.00, description: 'Monthly rent in Lempiras' })
  @IsNumber()
  @Min(0)
  monthlyRent: number;

  @ApiPropertyOptional({ example: 1, description: 'Day of month when payment is due (1-31)' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(31)
  paymentDay?: number;

  @ApiPropertyOptional({ example: 17000.00, description: 'Security deposit in Lempiras' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ enum: LeaseStatus, example: LeaseStatus.PENDING })
  @IsEnum(LeaseStatus)
  @IsOptional()
  status?: LeaseStatus;

  @ApiPropertyOptional({ example: 'No se permiten mascotas. Incluye agua y luz.' })
  @IsString()
  @IsOptional()
  terms?: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/contracts/contrato-001.pdf' })
  @IsString()
  @IsOptional()
  contractUrl?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Number of advance rent months to auto-generate as paid payments on lease creation (default 1)',
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(12)
  advanceMonths?: number;
}

export class UpdateLeaseDto extends PartialType(CreateLeaseDto) {}

export class RenewLeaseDto {
  @ApiProperty({ example: '2028-03-31', description: 'New end date (must be after current end date)' })
  @IsDateString()
  newEndDate: string;

  @ApiPropertyOptional({ example: 9500.00, description: 'New monthly rent. Keeps current rent if not provided.' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  newMonthlyRent?: number;

  @ApiPropertyOptional({ example: 'Renovación por 12 meses adicionales' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ChangeLeaseStatusDto {
  @ApiProperty({ enum: LeaseStatus, example: LeaseStatus.ACTIVE })
  @IsEnum(LeaseStatus)
  status: LeaseStatus;
}

export class LeaseQueryDto {
  @ApiPropertyOptional({ description: 'Filter by unit ID' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ description: 'Filter by tenant ID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ enum: LeaseStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

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

  @ApiPropertyOptional({
    enum: ['startDate', 'endDate', 'monthlyRent', 'createdAt'],
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsIn(['startDate', 'endDate', 'monthlyRent', 'createdAt'])
  sortBy?: 'startDate' | 'endDate' | 'monthlyRent' | 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
