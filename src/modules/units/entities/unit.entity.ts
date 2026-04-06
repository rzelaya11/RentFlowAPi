import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { Property } from '@/modules/properties/entities/property.entity';
import { Lease } from '@/modules/leases/entities/lease.entity';
import { MaintenanceRequest } from '@/modules/maintenance/entities/maintenance-request.entity';

export enum UnitStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
}

@Entity('units')
export class Unit extends BaseEntity {
  @Column({ name: 'unit_number' })
  unitNumber: string;

  @Column({ name: 'area_sqm', type: 'decimal', precision: 8, scale: 2, nullable: true })
  areaSqm: number;

  @Column({ type: 'int', nullable: true })
  bedrooms: number;

  @Column({ type: 'int', nullable: true })
  bathrooms: number;

  @Column({ name: 'base_rent', type: 'decimal', precision: 12, scale: 2 })
  baseRent: number;

  @Column({ type: 'enum', enum: UnitStatus, default: UnitStatus.AVAILABLE })
  status: UnitStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  // Relations
  @Column({ name: 'property_id' })
  propertyId: string;

  @ManyToOne(() => Property, (property) => property.units, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id' })
  property: Property;

  @OneToMany(() => Lease, (lease) => lease.unit)
  leases: Lease[];

  @OneToMany(() => MaintenanceRequest, (mr) => mr.unit)
  maintenanceRequests: MaintenanceRequest[];
}
