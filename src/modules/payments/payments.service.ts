import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Payment, PaymentStatus, PaymentType } from './entities/payment.entity';
import { Lease, LeaseStatus } from '@/modules/leases/entities/lease.entity';
import {
  CreatePaymentDto,
  UpdatePaymentDto,
  RecordPaymentDto,
  GeneratePaymentsDto,
  PaymentQueryDto,
} from './dto/payment.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
  ) {}

  // Verify lease exists and belongs to the current user through unit → property
  private async verifyLeaseOwnership(leaseId: string, userId: string): Promise<Lease> {
    const lease = await this.leaseRepository.findOne({
      where: { id: leaseId },
      relations: ['unit', 'unit.property'],
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID "${leaseId}" not found`);
    }

    if (lease.unit.property.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this lease');
    }

    return lease;
  }

  // Verify payment exists and belongs to the current user
  private async verifyPaymentOwnership(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
      relations: ['lease', 'lease.unit', 'lease.unit.property'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID "${paymentId}" not found`);
    }

    if (payment.lease.unit.property.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    return payment;
  }

  async updateOverduePayments(): Promise<void> {
    // Midnight today: due_date < today means strictly yesterday or earlier
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.paymentRepository.update(
      { status: PaymentStatus.PENDING, dueDate: LessThan(today) as any },
      { status: PaymentStatus.OVERDUE },
    );
  }

  async create(dto: CreatePaymentDto, user: User): Promise<Payment> {
    await this.verifyLeaseOwnership(dto.leaseId, user.id);

    const payment = this.paymentRepository.create(dto);
    return this.paymentRepository.save(payment);
  }

  async findAll(
    query: PaymentQueryDto,
    user: User,
  ): Promise<PaginatedResponseDto<Payment>> {
    await this.updateOverduePayments();

    const { leaseId, status, method, type, page = 1, limit = 20 } = query;
    const dueDateFrom = query.dueDateFrom ?? query.fromDate;
    const dueDateTo = query.dueDateTo ?? query.toDate;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .leftJoinAndSelect('payment.lease', 'paymentLease')
      .leftJoinAndSelect('paymentLease.tenant', 'tenant')
      .leftJoinAndSelect('paymentLease.unit', 'paymentUnit')
      .where('property.ownerId = :ownerId', { ownerId: user.id });

    if (leaseId) {
      qb.andWhere('payment.leaseId = :leaseId', { leaseId });
    }

    if (status) {
      qb.andWhere('payment.status = :status', { status });
    }

    if (method) {
      qb.andWhere('payment.method = :method', { method });
    }

    if (type) {
      qb.andWhere('payment.type = :type', { type });
    }

    if (dueDateFrom) {
      qb.andWhere('payment.dueDate >= :dueDateFrom', { dueDateFrom });
    }

    if (dueDateTo) {
      qb.andWhere('payment.dueDate <= :dueDateTo', { dueDateTo });
    }

    qb.orderBy('payment.dueDate', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, user: User): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['lease', 'lease.unit', 'lease.unit.property', 'lease.tenant'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID "${id}" not found`);
    }

    if (payment.lease.unit.property.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    return payment;
  }

  async update(id: string, dto: UpdatePaymentDto, user: User): Promise<Payment> {
    const payment = await this.verifyPaymentOwnership(id, user.id);
    Object.assign(payment, dto);
    return this.paymentRepository.save(payment);
  }

  async recordPayment(id: string, dto: RecordPaymentDto, user: User): Promise<Payment> {
    const payment = await this.verifyPaymentOwnership(id, user.id);

    if (payment.status === PaymentStatus.PAID) {
      throw new BadRequestException('Payment has already been recorded as paid');
    }

    const paidAmount = dto.amountPaid ?? payment.amount;
    const expectedAmount = Number(payment.amount);

    payment.paidDate = new Date(dto.paidDate ?? new Date().toISOString().split('T')[0]) as any;
    payment.method = dto.method;
    payment.referenceNumber = dto.referenceNumber ?? payment.referenceNumber;
    payment.notes = dto.notes ?? payment.notes;
    payment.status = paidAmount < expectedAmount ? PaymentStatus.PARTIAL : PaymentStatus.PAID;

    if (dto.amountPaid) {
      payment.amount = dto.amountPaid as any;
    }

    return this.paymentRepository.save(payment);
  }

  async generateMonthlyPayments(dto: GeneratePaymentsDto, user: User): Promise<Payment[]> {
    const lease = await this.verifyLeaseOwnership(dto.leaseId, user.id);

    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException('Can only generate payments for active leases');
    }

    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);
    const paymentDay = lease.paymentDay;

    const payments: Payment[] = [];
    const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);

    while (current <= toDate) {
      // Build due date using paymentDay, clamped to last day of month
      const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
      const day = Math.min(paymentDay, lastDay);
      const dueDate = new Date(current.getFullYear(), current.getMonth(), day);

      // Skip if dueDate is outside the requested range
      if (dueDate >= fromDate && dueDate <= toDate) {
        // Skip if a payment already exists for this lease and due date
        const exists = await this.paymentRepository.findOne({
          where: { leaseId: dto.leaseId, dueDate: dueDate as any },
        });

        if (!exists) {
          const payment = this.paymentRepository.create({
            leaseId: dto.leaseId,
            amount: lease.monthlyRent,
            dueDate: dueDate as any,
            status: PaymentStatus.PENDING,
          });
          payments.push(payment);
        }
      }

      // Advance to next month
      current.setMonth(current.getMonth() + 1);
    }

    if (payments.length === 0) {
      throw new BadRequestException('No new payments to generate for the specified range');
    }

    return this.paymentRepository.save(payments);
  }

  async getOverduePayments(user: User): Promise<Payment[]> {
    await this.updateOverduePayments();

    return this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .leftJoinAndSelect('payment.lease', 'paymentLease')
      .leftJoinAndSelect('paymentLease.tenant', 'tenant')
      .leftJoinAndSelect('paymentLease.unit', 'paymentUnit')
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .andWhere('payment.status = :status', { status: PaymentStatus.OVERDUE })
      .orderBy('payment.dueDate', 'ASC')
      .getMany();
  }

  async getPaymentSummary(user: User) {
    await this.updateOverduePayments();

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const ownerFilter = { ownerId: user.id };

    // Monthly stats for pending / paid / partial (excluding overdue — those have no month boundary)
    const monthlyRows = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('payment.status', 'status')
      .addSelect('COUNT(payment.id)', 'count')
      .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
      .where('property.ownerId = :ownerId', ownerFilter)
      .andWhere('payment.dueDate BETWEEN :firstDay AND :lastDay', { firstDay, lastDay })
      .andWhere('payment.status != :overdue', { overdue: PaymentStatus.OVERDUE })
      .groupBy('payment.status')
      .getRawMany();

    // ALL-TIME overdue (not limited to current month — a debt from any month still counts)
    const overdueRow = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('COUNT(payment.id)', 'count')
      .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
      .where('property.ownerId = :ownerId', ownerFilter)
      .andWhere('payment.status = :status', { status: PaymentStatus.OVERDUE })
      .getRawOne();

    const summary = {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      pending: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      overdue: { count: 0, total: 0 },
      partial: { count: 0, total: 0 },
    };

    for (const row of monthlyRows) {
      const key = row.status as keyof Omit<typeof summary, 'month'>;
      if (summary[key] !== undefined) {
        summary[key] = {
          count: parseInt(row.count) || 0,
          total: parseFloat(row.total) || 0,
        };
      }
    }

    summary.overdue = {
      count: parseInt(overdueRow?.count) || 0,
      total: parseFloat(overdueRow?.total) || 0,
    };

    return summary;
  }

  async remove(id: string, user: User): Promise<void> {
    const payment = await this.verifyPaymentOwnership(id, user.id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be deleted');
    }

    await this.paymentRepository.remove(payment);
  }
}
