import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  RecordPaymentDto,
  GeneratePaymentsDto,
  PaymentQueryDto,
} from './dto/payment.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a single payment record' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 404, description: 'Lease not found' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.paymentsService.create(dto, user);
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Bulk-generate monthly pending payments for an active lease',
    description: 'Creates one payment per month in the given range using the lease monthlyRent and paymentDay. Skips months that already have a payment.',
  })
  @ApiResponse({ status: 201, description: 'Payments generated successfully' })
  @ApiResponse({ status: 400, description: 'Lease is not active, or no new payments to generate' })
  @ApiResponse({ status: 404, description: 'Lease not found' })
  generateMonthlyPayments(@Body() dto: GeneratePaymentsDto, @CurrentUser() user: User) {
    return this.paymentsService.generateMonthlyPayments(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'List payments with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of payments' })
  findAll(@Query() query: PaymentQueryDto, @CurrentUser() user: User) {
    return this.paymentsService.findAll(query, user);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'Get all overdue payments (due date passed, not yet paid)' })
  @ApiResponse({ status: 200, description: 'List of overdue payments with tenant and unit info' })
  getOverduePayments(@CurrentUser() user: User) {
    return this.paymentsService.getOverduePayments(user);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get payment summary for the current month grouped by status' })
  @ApiResponse({ status: 200, description: 'Monthly summary: pending, paid, overdue, partial totals' })
  getPaymentSummary(@CurrentUser() user: User) {
    return this.paymentsService.getPaymentSummary(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single payment with full lease and tenant details' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment details' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.paymentsService.findOne(id, user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a payment record (does not change status automatically)' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.update(id, dto, user);
  }

  @Patch(':id/record')
  @ApiOperation({
    summary: 'Record a payment as paid',
    description: 'Marks the payment as paid (or partial if amountPaid < expected). Sets paidDate, method and referenceNumber.',
  })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment recorded. Status set to paid or partial.' })
  @ApiResponse({ status: 400, description: 'Payment already paid' })
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.paymentsService.recordPayment(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a payment (only pending payments can be deleted)' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 204, description: 'Payment deleted' })
  @ApiResponse({ status: 400, description: 'Only pending payments can be deleted' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.paymentsService.remove(id, user);
  }
}
