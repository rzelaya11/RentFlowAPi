import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsUUID,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethod, PaymentType } from '../entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({ example: 'uuid-del-contrato' })
  @IsUUID()
  @IsNotEmpty()
  leaseId: string;

  @ApiProperty({ example: 8500.00, description: 'Payment amount in Lempiras' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-04-01', description: 'Payment due date (YYYY-MM-DD)' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ example: '2026-04-03', description: 'Date payment was received' })
  @IsDateString()
  @IsOptional()
  paidDate?: string;

  @ApiPropertyOptional({ enum: PaymentStatus, example: PaymentStatus.PENDING })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.TRANSFER })
  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @ApiPropertyOptional({ example: 'TRF-20260403-001' })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional({ enum: PaymentType, example: PaymentType.RENT, default: PaymentType.RENT })
  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;

  @ApiPropertyOptional({ example: 'Pago correspondiente al mes de abril 2026' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdatePaymentDto extends PartialType(
  OmitType(CreatePaymentDto, ['leaseId'] as const),
) {}

export class RecordPaymentDto {
  @ApiPropertyOptional({
    example: '2026-04-03',
    description: 'Date payment was received. Defaults to today if not provided.',
  })
  @IsDateString()
  @IsOptional()
  paidDate?: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.TRANSFER })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ example: 'TRF-20260403-001' })
  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @ApiPropertyOptional({ example: 'Inquilino pagó en efectivo en oficina' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    example: 8500.00,
    description: 'Amount actually paid. If less than due amount, status becomes partial.',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  amountPaid?: number;
}

export class GeneratePaymentsDto {
  @ApiProperty({ example: 'uuid-del-contrato' })
  @IsUUID()
  @IsNotEmpty()
  leaseId: string;

  @ApiProperty({ example: '2026-04-01', description: 'Start of generation range (YYYY-MM-DD)' })
  @IsDateString()
  fromDate: string;

  @ApiProperty({ example: '2027-03-01', description: 'End of generation range (YYYY-MM-DD)' })
  @IsDateString()
  toDate: string;
}

export class PaymentQueryDto {
  @ApiPropertyOptional({ description: 'Filter by lease ID' })
  @IsOptional()
  @IsUUID()
  leaseId?: string;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'Filter by status' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'Filter by payment method' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentType, description: 'Filter by payment type' })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Due date from (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Due date to (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Alias for dueDateFrom (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Alias for dueDateTo (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

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
