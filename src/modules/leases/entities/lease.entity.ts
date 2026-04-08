import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Unit } from '@/modules/units/entities/unit.entity';
import { Tenant } from '@/modules/tenants/entities/tenant.entity';
import { Payment } from '@/modules/payments/entities/payment.entity';

export enum LeaseStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

// Keeps PostgreSQL 'date' columns as plain YYYY-MM-DD strings —
// avoids UTC offset shifting the displayed day in the frontend.
const dateStringTransformer = {
  to: (value: string | null) => value,
  from: (value: string | null) => value,
};

@Entity('leases')
export class Lease extends BaseEntity {
  @Column({ name: 'start_date', type: 'date', transformer: dateStringTransformer })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', transformer: dateStringTransformer })
  endDate: string;

  @Column({ name: 'monthly_rent', type: 'decimal', precision: 12, scale: 2 })
  monthlyRent: number;

  @Column({ name: 'payment_day', type: 'int', default: 1 })
  paymentDay: number;

  @Column({ name: 'deposit_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  depositAmount: number;

  @Column({ type: 'enum', enum: LeaseStatus, default: LeaseStatus.PENDING })
  status: LeaseStatus;

  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({ name: 'contract_url', nullable: true })
  contractUrl: string;

  // Relations
  @Column({ name: 'unit_id' })
  unitId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Unit, (unit) => unit.leases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @ManyToOne(() => Tenant, (tenant) => tenant.leases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => Payment, (payment) => payment.lease)
  payments: Payment[];
}
