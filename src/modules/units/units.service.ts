import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from './entities/unit.entity';
import { Property } from '@/modules/properties/entities/property.entity';
import { CreateUnitDto, UpdateUnitDto, UnitQueryDto } from './dto/unit.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class UnitsService {
  constructor(
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  // Verify property exists and belongs to the current user
  private async verifyPropertyOwnership(propertyId: string, userId: string): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException(`Property with ID "${propertyId}" not found`);
    }

    if (property.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this property');
    }

    return property;
  }

  async create(dto: CreateUnitDto, user: User): Promise<Unit> {
    await this.verifyPropertyOwnership(dto.propertyId!, user.id);

    const unit = this.unitRepository.create(dto);
    return this.unitRepository.save(unit);
  }

  async findAll(
    query: UnitQueryDto,
    user: User,
  ): Promise<PaginatedResponseDto<Unit>> {
    const { propertyId, status, search, page = 1, limit = 20 } = query;

    const qb = this.unitRepository
      .createQueryBuilder('unit')
      .innerJoin('unit.property', 'property')
      .where('property.ownerId = :ownerId', { ownerId: user.id });

    if (propertyId) {
      qb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }

    if (status) {
      qb.andWhere('unit.status = :status', { status });
    }

    if (search) {
      qb.andWhere('unit.unit_number ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('unit.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, user: User): Promise<Unit> {
    const unit = await this.unitRepository.findOne({
      where: { id },
      relations: ['property', 'leases', 'leases.tenant'],
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID "${id}" not found`);
    }

    if (unit.property.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this unit');
    }

    return unit;
  }

  async update(id: string, dto: UpdateUnitDto, user: User): Promise<Unit> {
    const unit = await this.findOne(id, user);

    // If changing property, verify ownership of the new property
    if (dto.propertyId && dto.propertyId !== unit.propertyId) {
      await this.verifyPropertyOwnership(dto.propertyId!, user.id);
    }

    Object.assign(unit, dto);
    return this.unitRepository.save(unit);
  }

  async remove(id: string, user: User): Promise<void> {
    const unit = await this.findOne(id, user);
    await this.unitRepository.remove(unit);
  }

  async findAvailable(propertyId: string, user: User): Promise<Unit[]> {
    await this.verifyPropertyOwnership(propertyId, user.id);

    return this.unitRepository
      .createQueryBuilder('unit')
      .where('unit.propertyId = :propertyId', { propertyId })
      .andWhere("unit.status = 'available'")
      .orderBy('unit.unitNumber', 'ASC')
      .getMany();
  }

  async getStatsByProperty(propertyId: string, user: User) {
    await this.verifyPropertyOwnership(propertyId, user.id);

    const stats = await this.unitRepository
      .createQueryBuilder('unit')
      .select('COUNT(unit.id)', 'total')
      .addSelect(`COUNT(CASE WHEN unit.status = 'available' THEN 1 END)`, 'available')
      .addSelect(`COUNT(CASE WHEN unit.status = 'occupied' THEN 1 END)`, 'occupied')
      .addSelect(`COUNT(CASE WHEN unit.status = 'maintenance' THEN 1 END)`, 'maintenance')
      .addSelect('SUM(unit.base_rent)', 'total_rent')
      .where('unit.propertyId = :propertyId', { propertyId })
      .getRawOne();

    return {
      total: parseInt(stats.total) || 0,
      available: parseInt(stats.available) || 0,
      occupied: parseInt(stats.occupied) || 0,
      maintenance: parseInt(stats.maintenance) || 0,
      totalRent: parseFloat(stats.total_rent) || 0,
      occupancyRate:
        stats.total > 0
          ? Math.round((stats.occupied / stats.total) * 100)
          : 0,
    };
  }
}
