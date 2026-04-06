import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Lease } from '@/modules/leases/entities/lease.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  PARTIAL = 'partial',
}

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  CARD = 'card',
  OTHER = 'other',
}

export enum PaymentType {
  RENT = 'rent',
  DEPOSIT = 'deposit',
  LATE_FEE = 'late_fee',
  OTHER = 'other',
}

@Entity('payments')
export class Payment extends BaseEntity {
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({ name: 'paid_date', type: 'date', nullable: true })
  paidDate: Date;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentType, default: PaymentType.RENT })
  type: PaymentType;

  @Column({ name: 'reference_number', nullable: true })
  referenceNumber: string;

  @Column({ name: 'receipt_url', nullable: true })
  receiptUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relations
  @Column({ name: 'lease_id' })
  leaseId: string;

  @ManyToOne(() => Lease, (lease) => lease.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lease_id' })
  lease: Lease;
}
