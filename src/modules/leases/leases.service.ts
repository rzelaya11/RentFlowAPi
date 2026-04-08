import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lease, LeaseStatus } from './entities/lease.entity';
import { Unit, UnitStatus } from '@/modules/units/entities/unit.entity';
import { Tenant } from '@/modules/tenants/entities/tenant.entity';
import { Payment, PaymentStatus, PaymentMethod, PaymentType } from '@/modules/payments/entities/payment.entity';
import {
  CreateLeaseDto,
  UpdateLeaseDto,
  ChangeLeaseStatusDto,
  LeaseQueryDto,
  RenewLeaseDto,
} from './dto/lease.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class LeasesService {
  constructor(
    @InjectRepository(Lease)
    private readonly leaseRepository: Repository<Lease>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  // Verify unit exists and belongs to the current user through property
  private async verifyUnitOwnership(unitId: string, userId: string): Promise<Unit> {
    const unit = await this.unitRepository.findOne({
      where: { id: unitId },
      relations: ['property'],
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID "${unitId}" not found`);
    }

    if (unit.property.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this unit');
    }

    return unit;
  }

  // Verify tenant exists and belongs to the current user
  private async verifyTenantOwnership(tenantId: string, userId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${tenantId}" not found`);
    }

    if (tenant.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this tenant');
    }

    return tenant;
  }

  // Update unit status based on active leases
  private async syncUnitStatus(unitId: string): Promise<void> {
    const activeLease = await this.leaseRepository.findOne({
      where: { unitId, status: LeaseStatus.ACTIVE },
    });

    const newStatus = activeLease ? UnitStatus.OCCUPIED : UnitStatus.AVAILABLE;
    await this.unitRepository.update(unitId, { status: newStatus });
  }

  // Format a Date as YYYY-MM-DD string (no timezone conversion)
  private toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Auto-generate initial payments for a newly active lease
  private async createInitialPayments(lease: Lease, advanceMonths: number): Promise<void> {
    const todayStr = this.toDateString(new Date());
    const paymentsToSave: Partial<Payment>[] = [];

    // Deposit payment (if depositAmount > 0)
    if (Number(lease.depositAmount) > 0) {
      paymentsToSave.push({
        leaseId: lease.id,
        amount: lease.depositAmount,
        dueDate: todayStr,
        paidDate: todayStr,
        status: PaymentStatus.PAID,
        method: PaymentMethod.CASH,
        type: PaymentType.DEPOSIT,
        notes: 'Depósito de garantía',
      });
    }

    // Advance rent months
    const startDate = new Date(lease.startDate + 'T00:00:00');
    for (let i = 0; i < advanceMonths; i++) {
      const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, lease.paymentDay);
      paymentsToSave.push({
        leaseId: lease.id,
        amount: lease.monthlyRent,
        dueDate: this.toDateString(dueDate),
        paidDate: todayStr,
        status: PaymentStatus.PAID,
        method: PaymentMethod.CASH,
        type: PaymentType.RENT,
        notes: `Pago adelantado - Mes ${i + 1}`,
      });
    }

    if (paymentsToSave.length > 0) {
      await this.paymentRepository.save(
        paymentsToSave.map((p) => this.paymentRepository.create(p)),
      );
    }
  }

  async create(dto: CreateLeaseDto, user: User): Promise<Lease> {
    const unit = await this.verifyUnitOwnership(dto.unitId, user.id);
    await this.verifyTenantOwnership(dto.tenantId, user.id);

    // Prevent creating an active lease on an already occupied unit
    if (dto.status === LeaseStatus.ACTIVE && unit.status === UnitStatus.OCCUPIED) {
      throw new BadRequestException('Unit is already occupied by an active lease');
    }

    const { advanceMonths = 1, ...leaseData } = dto;
    const lease = this.leaseRepository.create(leaseData);
    const saved = await this.leaseRepository.save(lease);

    // Sync unit status and auto-generate payments if the new lease is active
    if (saved.status === LeaseStatus.ACTIVE) {
      await this.unitRepository.update(dto.unitId, { status: UnitStatus.OCCUPIED });
      await this.createInitialPayments(saved, advanceMonths);
    }

    return saved;
  }

  async findAll(
    query: LeaseQueryDto,
    user: User,
  ): Promise<PaginatedResponseDto<Lease>> {
    const { unitId, tenantId, status, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'asc' } = query;

    const qb = this.leaseRepository
      .createQueryBuilder('lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .leftJoinAndSelect('lease.unit', 'leaseUnit')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .where('property.ownerId = :ownerId', { ownerId: user.id });

    if (unitId) {
      qb.andWhere('lease.unitId = :unitId', { unitId });
    }

    if (tenantId) {
      qb.andWhere('lease.tenantId = :tenantId', { tenantId });
    }

    if (status) {
      qb.andWhere('lease.status = :status', { status });
    }

    qb.orderBy(`lease.${sortBy}`, sortOrder.toUpperCase() as 'ASC' | 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async getExpiring(days: number, user: User): Promise<Lease[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const until = new Date(today);
    until.setDate(today.getDate() + days);

    return this.leaseRepository
      .createQueryBuilder('lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .leftJoinAndSelect('lease.unit', 'leaseUnit')
      .leftJoinAndSelect('leaseUnit.property', 'leaseProperty')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .andWhere('lease.status = :status', { status: LeaseStatus.ACTIVE })
      .andWhere('lease.endDate BETWEEN :today AND :until', { today, until })
      .orderBy('lease.endDate', 'ASC')
      .getMany();
  }

  async findOne(id: string, user: User): Promise<Lease> {
    const lease = await this.leaseRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.property', 'tenant', 'payments'],
    });

    if (!lease) {
      throw new NotFoundException(`Lease with ID "${id}" not found`);
    }

    if (lease.unit.property.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this lease');
    }

    return lease;
  }

  async update(id: string, dto: UpdateLeaseDto, user: User): Promise<Lease> {
    const lease = await this.findOne(id, user);

    if (dto.unitId && dto.unitId !== lease.unitId) {
      await this.verifyUnitOwnership(dto.unitId, user.id);
    }

    if (dto.tenantId && dto.tenantId !== lease.tenantId) {
      await this.verifyTenantOwnership(dto.tenantId, user.id);
    }

    const previousStatus = lease.status;
    const { advanceMonths: _, ...updateData } = dto;
    Object.assign(lease, updateData);
    const saved = await this.leaseRepository.save(lease);

    // Sync unit status if status changed
    if (dto.status && dto.status !== previousStatus) {
      await this.syncUnitStatus(saved.unitId);
    }

    return saved;
  }

  async changeStatus(id: string, dto: ChangeLeaseStatusDto, user: User): Promise<Lease> {
    const lease = await this.findOne(id, user);

    // Validate transitions
    if (dto.status === LeaseStatus.ACTIVE && lease.unit.status === UnitStatus.OCCUPIED && lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException('Unit is already occupied by another active lease');
    }

    const previousStatus = lease.status;
    lease.status = dto.status;
    const saved = await this.leaseRepository.save(lease);

    if (dto.status !== previousStatus) {
      await this.syncUnitStatus(lease.unitId);
    }

    return saved;
  }

  async renew(id: string, dto: RenewLeaseDto, user: User): Promise<Lease> {
    const lease = await this.findOne(id, user);

    if (lease.status !== LeaseStatus.ACTIVE && lease.status !== LeaseStatus.EXPIRED) {
      throw new BadRequestException(
        'Only active or expired leases can be renewed',
      );
    }

    const currentEndDate = new Date(lease.endDate);
    const newEndDate = new Date(dto.newEndDate);

    if (newEndDate <= currentEndDate) {
      throw new BadRequestException(
        'New end date must be after the current end date',
      );
    }

    lease.endDate = dto.newEndDate;

    if (dto.newMonthlyRent !== undefined) {
      lease.monthlyRent = dto.newMonthlyRent as any; // decimal field, TypeORM handles coercion
    }

    if (dto.notes) {
      lease.terms = lease.terms
        ? `${lease.terms}\nRenovación: ${dto.notes}`
        : `Renovación: ${dto.notes}`;
    }

    lease.status = LeaseStatus.ACTIVE;

    const saved = await this.leaseRepository.save(lease);

    // Ensure unit stays occupied
    await this.unitRepository.update(lease.unitId, { status: UnitStatus.OCCUPIED });

    return saved;
  }

  async remove(id: string, user: User): Promise<void> {
    const lease = await this.findOne(id, user);
    const unitId = lease.unitId;

    await this.leaseRepository.remove(lease);
    await this.syncUnitStatus(unitId);
  }
}
