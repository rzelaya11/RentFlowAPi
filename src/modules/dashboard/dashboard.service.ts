import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from '@/modules/properties/entities/property.entity';
import { Unit, UnitStatus } from '@/modules/units/entities/unit.entity';
import { Lease, LeaseStatus } from '@/modules/leases/entities/lease.entity';
import { Payment, PaymentStatus } from '@/modules/payments/entities/payment.entity';
import { MaintenanceRequest, MaintenanceStatus } from '@/modules/maintenance/entities/maintenance-request.entity';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepo: Repository<Property>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Lease)
    private readonly leaseRepo: Repository<Lease>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(MaintenanceRequest)
    private readonly maintenanceRepo: Repository<MaintenanceRequest>,
  ) {}

  // Keep payment statuses in sync before dashboard queries
  private async syncOverduePayments(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.paymentRepo
      .createQueryBuilder()
      .update()
      .set({ status: PaymentStatus.OVERDUE })
      .where('status = :pending', { pending: PaymentStatus.PENDING })
      .andWhere('due_date < :today', { today })
      .execute();
  }

  async getDashboard(user: User) {
    // Sync overdue status before any query so all KPIs are consistent
    await this.syncOverduePayments();

    const [
      propertyStats,
      unitStats,
      incomeStats,
      upcomingExpirations,
      openMaintenance,
      topOverdueTenants,
    ] = await Promise.all([
      this.getPropertyStats(user.id),
      this.getUnitStats(user.id),
      this.getIncomeStats(user.id),
      this.getUpcomingExpirations(user.id),
      this.getOpenMaintenanceByPriority(user.id),
      this.getTopOverdueTenants(user.id),
    ]);

    const occupancyRate =
      unitStats.total > 0
        ? Math.round((unitStats.occupied / unitStats.total) * 100)
        : 0;

    return {
      properties: propertyStats,
      units: {
        ...unitStats,
        occupancyRate,
      },
      income: incomeStats,
      upcomingExpirations,
      openMaintenance,
      topOverdueTenants,
    };
  }

  // ── Properties ───────────────────────────────────────────────────────────────
  private async getPropertyStats(ownerId: string) {
    const total = await this.propertyRepo.count({ where: { ownerId } });
    return { total };
  }

  // ── Units ────────────────────────────────────────────────────────────────────
  private async getUnitStats(ownerId: string) {
    const rows = await this.unitRepo
      .createQueryBuilder('unit')
      .innerJoin('unit.property', 'property')
      .select('unit.status', 'status')
      .addSelect('COUNT(unit.id)', 'count')
      .where('property.ownerId = :ownerId', { ownerId })
      .groupBy('unit.status')
      .getRawMany();

    const map: Record<string, number> = {
      [UnitStatus.AVAILABLE]: 0,
      [UnitStatus.OCCUPIED]: 0,
      [UnitStatus.MAINTENANCE]: 0,
    };

    for (const row of rows) {
      map[row.status] = parseInt(row.count) || 0;
    }

    return {
      total: map.available + map.occupied + map.maintenance,
      available: map.available,
      occupied: map.occupied,
      maintenance: map.maintenance,
    };
  }

  // ── Income & payments ────────────────────────────────────────────────────────
  private async getIncomeStats(ownerId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const base = () =>
      this.paymentRepo
        .createQueryBuilder('payment')
        .innerJoin('payment.lease', 'lease')
        .innerJoin('lease.unit', 'unit')
        .innerJoin('unit.property', 'property')
        .where('property.ownerId = :ownerId', { ownerId });

    const [paidRow, pendingRow, partialRow, overdueRow] = await Promise.all([
      // Cobrado este mes: paid_date in current month
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.PAID })
        .andWhere('payment.paidDate >= :monthStart AND payment.paidDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),

      // Pendiente este mes: due_date in current month
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.PENDING })
        .andWhere('payment.dueDate >= :monthStart AND payment.dueDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),

      // Parcial: due_date in current month
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.PARTIAL })
        .andWhere('payment.dueDate >= :monthStart AND payment.dueDate < :monthEnd', { monthStart, monthEnd })
        .getRawOne(),

      // All-time overdue: any past month debt counts, no month boundary
      base()
        .select('COUNT(payment.id)', 'count')
        .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'total')
        .andWhere('payment.status = :s', { s: PaymentStatus.OVERDUE })
        .getRawOne(),
    ]);

    return {
      currentMonth: now.toISOString().slice(0, 7),
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

  // ── Upcoming lease expirations (next 30 days) ────────────────────────────────
  private async getUpcomingExpirations(ownerId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);

    const leases = await this.leaseRepo
      .createQueryBuilder('lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .leftJoinAndSelect('lease.unit', 'leaseUnit')
      .leftJoinAndSelect('leaseUnit.property', 'leaseProperty')
      .leftJoinAndSelect('lease.tenant', 'tenant')
      .where('property.ownerId = :ownerId', { ownerId })
      .andWhere('lease.status = :status', { status: LeaseStatus.ACTIVE })
      .andWhere('lease.endDate BETWEEN :today AND :in30Days', { today, in30Days })
      .orderBy('lease.endDate', 'ASC')
      .getMany();

    return leases.map((l) => ({
      leaseId: l.id,
      endDate: l.endDate,
      daysLeft: Math.ceil(
        (new Date(l.endDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      ),
      monthlyRent: l.monthlyRent,
      unit: {
        id: l.unit?.id,
        unitNumber: l.unit?.unitNumber,
        property: l.unit?.property?.name,
      },
      tenant: l.tenant
        ? { id: l.tenant.id, name: `${l.tenant.firstName} ${l.tenant.lastName}`, phone: l.tenant.phone }
        : null,
    }));
  }

  // ── Open maintenance by priority ─────────────────────────────────────────────
  private async getOpenMaintenanceByPriority(ownerId: string) {
    const rows = await this.maintenanceRepo
      .createQueryBuilder('mr')
      .innerJoin('mr.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('mr.priority', 'priority')
      .addSelect('COUNT(mr.id)', 'count')
      .where('property.ownerId = :ownerId', { ownerId })
      .andWhere('mr.status IN (:...statuses)', {
        statuses: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS],
      })
      .groupBy('mr.priority')
      .getRawMany();

    const summary = { urgent: 0, high: 0, medium: 0, low: 0, total: 0 };

    for (const row of rows) {
      const key = row.priority as keyof Omit<typeof summary, 'total'>;
      if (summary[key] !== undefined) {
        summary[key] = parseInt(row.count) || 0;
      }
    }

    summary.total = summary.urgent + summary.high + summary.medium + summary.low;

    return summary;
  }

  // ── Top 5 tenants with most overdue payments ─────────────────────────────────
  private async getTopOverdueTenants(ownerId: string) {
    const rows = await this.paymentRepo
      .createQueryBuilder('payment')
      .innerJoin('payment.lease', 'lease')
      .innerJoin('lease.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .innerJoin('lease.tenant', 'tenant')
      .select('tenant.id', 'tenant_id')
      .addSelect("CONCAT(tenant.first_name, ' ', tenant.last_name)", 'tenant_name')
      .addSelect('tenant.phone', 'phone')
      .addSelect('tenant.email', 'email')
      .addSelect('COUNT(payment.id)', 'overdue_count')
      .addSelect('COALESCE(SUM(payment.amount::numeric), 0)', 'overdue_total')
      .where('property.ownerId = :ownerId', { ownerId })
      .andWhere('payment.status = :status', { status: PaymentStatus.OVERDUE })
      .groupBy('tenant.id')
      .addGroupBy('tenant.first_name')
      .addGroupBy('tenant.last_name')
      .addGroupBy('tenant.phone')
      .addGroupBy('tenant.email')
      .orderBy('overdue_total', 'DESC')
      .limit(5)
      .getRawMany();

    return rows.map((row) => ({
      tenantId: row.tenant_id,
      name: row.tenant_name,
      phone: row.phone,
      email: row.email,
      overdueCount: parseInt(row.overdue_count) || 0,
      overdueTotal: parseFloat(row.overdue_total) || 0,
    }));
  }
}
