import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Lease } from '@/modules/leases/entities/lease.entity';
import { MaintenanceRequest } from '@/modules/maintenance/entities/maintenance-request.entity';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ nullable: true })
  email: string;

  @Column()
  phone: string;

  @Column({ name: 'id_number', nullable: true })
  idNumber: string;

  @Column({ name: 'emergency_contact', nullable: true })
  emergencyContact: string;

  @Column({ name: 'emergency_phone', nullable: true })
  emergencyPhone: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relations
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => Lease, (lease) => lease.tenant)
  leases: Lease[];

  @OneToMany(() => MaintenanceRequest, (mr) => mr.tenant)
  maintenanceRequests: MaintenanceRequest[];

  // Virtual
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
