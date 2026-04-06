import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Property } from './entities/property.entity';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyQueryDto,
} from './dto/property.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class PropertiesService {
  constructor(
    @InjectRepository(Property)
    private readonly propertyRepository: Repository<Property>,
  ) {}

  async create(dto: CreatePropertyDto, user: User): Promise<Property> {
    const property = this.propertyRepository.create({
      ...dto,
      ownerId: user.id,
    });

    return this.propertyRepository.save(property);
  }

  async findAll(
    query: PropertyQueryDto,
    user: User,
  ): Promise<PaginatedResponseDto<Property>> {
    const { search, type, city, page = 1, limit = 20 } = query;

    const qb = this.propertyRepository
      .createQueryBuilder('property')
      .leftJoinAndSelect('property.units', 'units')
      .where('property.ownerId = :ownerId', { ownerId: user.id });

    if (search) {
      qb.andWhere(
        '(property.name ILIKE :search OR property.address ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (type) {
      qb.andWhere('property.type = :type', { type });
    }

    if (city) {
      qb.andWhere('property.city ILIKE :city', { city: `%${city}%` });
    }

    qb.orderBy('property.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, user: User): Promise<Property> {
    const property = await this.propertyRepository.findOne({
      where: { id },
      relations: ['units', 'units.leases', 'units.leases.tenant'],
    });

    if (!property) {
      throw new NotFoundException(`Property with ID "${id}" not found`);
    }

    if (property.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this property');
    }

    return property;
  }

  async update(
    id: string,
    dto: UpdatePropertyDto,
    user: User,
  ): Promise<Property> {
    const property = await this.findOne(id, user);

    Object.assign(property, dto);

    return this.propertyRepository.save(property);
  }

  async remove(id: string, user: User): Promise<void> {
    const property = await this.findOne(id, user);
    await this.propertyRepository.remove(property);
  }

  async findAvailable(user: User): Promise<Property[]> {
    // Properties that have at least one unit with status = 'available'
    return this.propertyRepository
      .createQueryBuilder('property')
      .innerJoin('property.units', 'unit', "unit.status = 'available'")
      .leftJoinAndSelect('property.units', 'allUnits')
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .orderBy('property.name', 'ASC')
      .getMany();
  }

  async getStats(user: User) {
    const totalProperties = await this.propertyRepository.count({
      where: { ownerId: user.id },
    });

    const propertiesWithUnits = await this.propertyRepository
      .createQueryBuilder('property')
      .leftJoin('property.units', 'unit')
      .select('COUNT(DISTINCT property.id)', 'properties')
      .addSelect('COUNT(unit.id)', 'total_units')
      .addSelect(
        `COUNT(CASE WHEN unit.status = 'occupied' THEN 1 END)`,
        'occupied_units',
      )
      .addSelect(
        `COUNT(CASE WHEN unit.status = 'available' THEN 1 END)`,
        'available_units',
      )
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .getRawOne();

    return {
      totalProperties,
      totalUnits: parseInt(propertiesWithUnits.total_units) || 0,
      occupiedUnits: parseInt(propertiesWithUnits.occupied_units) || 0,
      availableUnits: parseInt(propertiesWithUnits.available_units) || 0,
      occupancyRate:
        propertiesWithUnits.total_units > 0
          ? Math.round(
              (propertiesWithUnits.occupied_units /
                propertiesWithUnits.total_units) *
                100,
            )
          : 0,
    };
  }
}
