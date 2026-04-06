import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Unit } from '@/modules/units/entities/unit.entity';
import { Tenant } from '@/modules/tenants/entities/tenant.entity';

export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum MaintenanceStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('maintenance_requests')
export class MaintenanceRequest extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: MaintenancePriority, default: MaintenancePriority.MEDIUM })
  priority: MaintenancePriority;

  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.OPEN })
  status: MaintenanceStatus;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ name: 'actual_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  actualCost: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string;

  // Relations
  @Column({ name: 'unit_id' })
  unitId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @ManyToOne(() => Unit, (unit) => unit.maintenanceRequests, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @ManyToOne(() => Tenant, (tenant) => tenant.maintenanceRequests, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
