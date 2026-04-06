import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto, UpdateTenantDto, TenantQueryDto } from './dto/tenant.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantDto, user: User): Promise<Tenant> {
    const tenant = this.tenantRepository.create({
      ...dto,
      ownerId: user.id,
    });
    return this.tenantRepository.save(tenant);
  }

  async findAll(
    query: TenantQueryDto,
    user: User,
  ): Promise<PaginatedResponseDto<Tenant>> {
    const { search, page = 1, limit = 20 } = query;

    const qb = this.tenantRepository
      .createQueryBuilder('tenant')
      .where('tenant.ownerId = :ownerId', { ownerId: user.id });

    if (search) {
      qb.andWhere(
        '(tenant.first_name ILIKE :search OR tenant.last_name ILIKE :search OR tenant.email ILIKE :search OR tenant.phone ILIKE :search OR tenant.id_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('tenant.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, user: User): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['leases', 'leases.unit', 'leases.unit.property'],
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID "${id}" not found`);
    }

    if (tenant.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this tenant');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto, user: User): Promise<Tenant> {
    const tenant = await this.findOne(id, user);
    Object.assign(tenant, dto);
    return this.tenantRepository.save(tenant);
  }

  async remove(id: string, user: User): Promise<void> {
    const tenant = await this.findOne(id, user);
    await this.tenantRepository.remove(tenant);
  }
}
