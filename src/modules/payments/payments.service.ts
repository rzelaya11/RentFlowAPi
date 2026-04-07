import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, LessThan } from 'typeorm';
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
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    private readonly dataSource: DataSource,
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

    const { leaseId, tenantId, propertyId, unitId, status, method, type, page = 1, limit = 20 } = query;
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

    if (tenantId) {
      qb.andWhere('lease.tenantId = :tenantId', { tenantId });
    }

    if (propertyId) {
      qb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }

    if (unitId) {
      qb.andWhere('lease.unitId = :unitId', { unitId });
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

  async generateMonthlyPayments(
    dto: GeneratePaymentsDto,
    user: User,
  ): Promise<{ generated: number; skipped: number; total: number }> {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    // Resolve which leases to process
    let leases: Lease[];
    const isSingleLease = dto.leaseId && dto.leaseId !== 'all';

    if (isSingleLease) {
      const lease = await this.verifyLeaseOwnership(dto.leaseId!, user.id);
      if (lease.status !== LeaseStatus.ACTIVE) {
        throw new BadRequestException('Can only generate payments for active leases');
      }
      leases = [lease];
    } else {
      leases = await this.leaseRepository
        .createQueryBuilder('lease')
        .innerJoin('lease.unit', 'unit')
        .innerJoin('unit.property', 'property')
        .where('property.ownerId = :ownerId', { ownerId: user.id })
        .andWhere('lease.status = :status', { status: LeaseStatus.ACTIVE })
        .getMany();

      if (leases.length === 0) {
        throw new BadRequestException('No active leases found for this user');
      }
    }

    let generated = 0;
    let skipped = 0;
    const toSave: Payment[] = [];

    for (const lease of leases) {
      const current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);

      while (current <= toDate) {
        const year = current.getFullYear();
        const month = current.getMonth() + 1; // 1-based

        // Clamp paymentDay to last day of month
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(lease.paymentDay, lastDay);
        const dueDate = new Date(year, current.getMonth(), day);

        if (dueDate >= fromDate && dueDate <= toDate) {
          // Check by year+month so changing paymentDay won't create duplicates
          const exists = await this.paymentRepository
            .createQueryBuilder('p')
            .where('p.leaseId = :leaseId', { leaseId: lease.id })
            .andWhere('p.type = :type', { type: PaymentType.RENT })
            .andWhere("EXTRACT(YEAR FROM p.due_date) = :year", { year })
            .andWhere("EXTRACT(MONTH FROM p.due_date) = :month", { month })
            .getCount();

          if (exists === 0) {
            toSave.push(
              this.paymentRepository.create({
                leaseId: lease.id,
                amount: lease.monthlyRent,
                dueDate: dueDate as any,
                status: PaymentStatus.PENDING,
                type: PaymentType.RENT,
              }),
            );
            generated++;
          } else {
            skipped++;
          }
        }

        current.setMonth(current.getMonth() + 1);
      }
    }

    if (toSave.length > 0) {
      await this.paymentRepository.save(toSave);
    }

    return { generated, skipped, total: generated + skipped };
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

    // ── DEBUG: raw queries to diagnose what's in the DB ──────────────────────
    const [dbPending, dbOverdue, dbMonthly] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount::numeric), 0) AS total
         FROM payments
         WHERE status = 'pending'
           AND due_date >= DATE_TRUNC('month', CURRENT_DATE)
           AND due_date <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount::numeric), 0) AS total
         FROM payments
         WHERE status = 'overdue'`,
      ),
      this.dataSource.query(
        `SELECT id, amount, status, due_date, paid_date
         FROM payments
         WHERE due_date >= DATE_TRUNC('month', CURRENT_DATE)
           AND due_date <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
         ORDER BY due_date`,
      ),
    ]);
    this.logger.debug('[getSummary] pending this month:', dbPending[0]);
    this.logger.debug('[getSummary] overdue all-time:', dbOverdue[0]);
    this.logger.debug('[getSummary] all payments this month:', dbMonthly);
    // ─────────────────────────────────────────────────────────────────────────

    const now = new Date();
    // First day of current month at 00:00:00 local
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // First day of NEXT month at 00:00:00 local — use strict < to avoid end-of-day issues
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Factory: base QB with ownership join already applied
    const base = () =>
      this.paymentRepository
        .createQueryBuilder('payment')
        .innerJoin('payment.lease', 'lease')
        .innerJoin('lease.unit', 'unit')
        .innerJoin('unit.property', 'property')
        .where('property.ownerId = :ownerId', { ownerId: user.id });

    const [paidRow, pendingRow, partialRow, overdueRow, monthlyCountRow] = await Promise.all([
      // Cobrado este mes: status=paid AND paidDate in current month
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.PAID })
        .andWhere('payment.paidDate >= :monthStart AND payment.paidDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),

      // Pendiente este mes: status=pending AND dueDate in current month
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.PENDING })
        .andWhere('payment.dueDate >= :monthStart AND payment.dueDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),

      // Parcial: status=partial AND dueDate in current month
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.PARTIAL })
        .andWhere('payment.dueDate >= :monthStart AND payment.dueDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),

      // Vencidos: all-time, no month boundary
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.OVERDUE })
        .getRawOne(),

      // Total payments with dueDate in current month (any status)
      base()
        .select('COUNT(payment.id)', 'count')
        .andWhere('payment.dueDate >= :monthStart AND payment.dueDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),
    ]);

    return {
      month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      monthlyPaymentsCount: parseInt(monthlyCountRow?.count) || 0,
      paid: {
        count: parseInt(paidRow?.count) || 0,
        total: parseFloat(paidRow?.total) || 0,
      },
      pending: {
        count: parseInt(pendingRow?.count) || 0,
        total: parseFloat(pendingRow?.total) || 0,
      },
      overdue: {
        count: parseInt(overdueRow?.count) || 0,
        total: parseFloat(overdueRow?.total) || 0,
      },
      partial: {
        count: parseInt(partialRow?.count) || 0,
        total: parseFloat(partialRow?.total) || 0,
      },
    };
  }

  async remove(id: string, user: User): Promise<void> {
    const payment = await this.verifyPaymentOwnership(id, user.id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be deleted');
    }

    await this.paymentRepository.remove(payment);
  }
}
