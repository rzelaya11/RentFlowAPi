import { Entity, Column, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@/common/entities/base.entity';
import { Property } from '@/modules/properties/entities/property.entity';

export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  VIEWER = 'viewer',
}

@Entity('users')
export class User extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  @Exclude()
  passwordHash: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.OWNER })
  role: UserRole;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Property, (property) => property.owner)
  properties: Property[];

  // Virtual: full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }
}
