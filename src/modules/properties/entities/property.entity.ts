import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { BaseEntity } from '@/common/entities/base.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Unit } from '@/modules/units/entities/unit.entity';

export enum PropertyType {
  HOUSE = 'house',
  APARTMENT = 'apartment',
  COMMERCIAL = 'commercial',
  LAND = 'land',
}

@Entity('properties')
export class Property extends BaseEntity {
  @Column()
  name: string;

  @Column()
  address: string;

  @Column()
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ name: 'zip_code', nullable: true })
  zipCode: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ type: 'enum', enum: PropertyType, default: PropertyType.HOUSE })
  type: PropertyType;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relations
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.properties, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @OneToMany(() => Unit, (unit) => unit.property)
  units: Unit[];
}
