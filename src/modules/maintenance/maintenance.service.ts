import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceRequest, MaintenanceStatus } from './entities/maintenance-request.entity';
import { Unit } from '@/modules/units/entities/unit.entity';
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  ChangeMaintenanceStatusDto,
  MaintenanceQueryDto,
} from './dto/maintenance.dto';
import { PaginatedResponseDto } from '@/common/dto/paginated-response.dto';
import { User } from '@/modules/users/entities/user.entity';

// Valid status transitions
const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.OPEN]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED],
  [MaintenanceStatus.IN_PROGRESS]: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
  [MaintenanceStatus.COMPLETED]: [],
  [MaintenanceStatus.CANCELLED]: [],
};

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRequest)
    private readonly maintenanceRepository: Repository<MaintenanceRequest>,
    @InjectRepository(Unit)
    private readonly unitRepository: Repository<Unit>,
  ) {}

  private async verifyUnitOwnership(unitId: string, userId: string): Promise<Unit> {
    const unit = await this.unitRepository.findOne({
      where: { id: unitId },
      relations: ['property'],
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID "${unitId}" not found`);
    }

    if (unit.property.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this unit');
    }

    return unit;
  }

  private async verifyOwnership(id: string, userId: string): Promise<MaintenanceRequest> {
    const request = await this.maintenanceRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.property'],
    });

    if (!request) {
      throw new NotFoundException(`Maintenance request with ID "${id}" not found`);
    }

    if (request.unit.property.ownerId !== userId) {
      throw new ForbiddenException('You do not have access to this maintenance request');
    }

    return request;
  }

  async create(dto: CreateMaintenanceDto, user: User): Promise<MaintenanceRequest> {
    await this.verifyUnitOwnership(dto.unitId, user.id);

    const request = this.maintenanceRepository.create(dto);
    return this.maintenanceRepository.save(request);
  }

  async findAll(
    query: MaintenanceQueryDto,
    user: User,
  ): Promise<PaginatedResponseDto<MaintenanceRequest>> {
    const { unitId, tenantId, propertyId, status, priority, page = 1, limit = 20 } = query;

    const qb = this.maintenanceRepository
      .createQueryBuilder('mr')
      .innerJoin('mr.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .leftJoinAndSelect('mr.unit', 'mrUnit')
      .leftJoinAndSelect('mr.tenant', 'tenant')
      .where('property.ownerId = :ownerId', { ownerId: user.id });

    if (unitId) {
      qb.andWhere('mr.unitId = :unitId', { unitId });
    }

    if (tenantId) {
      qb.andWhere('mr.tenantId = :tenantId', { tenantId });
    }

    if (propertyId) {
      qb.andWhere('unit.propertyId = :propertyId', { propertyId });
    }

    if (status) {
      qb.andWhere('mr.status = :status', { status });
    }

    if (priority) {
      qb.andWhere('mr.priority = :priority', { priority });
    }

    qb.orderBy('mr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string, user: User): Promise<MaintenanceRequest> {
    const request = await this.maintenanceRepository.findOne({
      where: { id },
      relations: ['unit', 'unit.property', 'tenant'],
    });

    if (!request) {
      throw new NotFoundException(`Maintenance request with ID "${id}" not found`);
    }

    if (request.unit.property.ownerId !== user.id) {
      throw new ForbiddenException('You do not have access to this maintenance request');
    }

    return request;
  }

  async update(
    id: string,
    dto: UpdateMaintenanceDto,
    user: User,
  ): Promise<MaintenanceRequest> {
    const request = await this.verifyOwnership(id, user.id);
    Object.assign(request, dto);
    return this.maintenanceRepository.save(request);
  }

  async changeStatus(
    id: string,
    dto: ChangeMaintenanceStatusDto,
    user: User,
  ): Promise<MaintenanceRequest> {
    const request = await this.verifyOwnership(id, user.id);

    const allowed = ALLOWED_TRANSITIONS[request.status];

    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from "${request.status}" to "${dto.status}". ` +
        `Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`,
      );
    }

    request.status = dto.status;

    if (dto.resolutionNotes !== undefined) {
      request.resolutionNotes = dto.resolutionNotes;
    }

    if (dto.actualCost !== undefined) {
      request.actualCost = dto.actualCost as any;
    }

    if (dto.status === MaintenanceStatus.COMPLETED) {
      request.completedAt = new Date();
    }

    return this.maintenanceRepository.save(request);
  }

  async remove(id: string, user: User): Promise<void> {
    const request = await this.verifyOwnership(id, user.id);
    await this.maintenanceRepository.remove(request);
  }

  async getMaintenanceStats(user: User) {
    const byStatus = await this.maintenanceRepository
      .createQueryBuilder('mr')
      .innerJoin('mr.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('mr.status', 'status')
      .addSelect('COUNT(mr.id)', 'count')
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .groupBy('mr.status')
      .getRawMany();

    const byPriority = await this.maintenanceRepository
      .createQueryBuilder('mr')
      .innerJoin('mr.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('mr.priority', 'priority')
      .addSelect('COUNT(mr.id)', 'count')
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .andWhere('mr.status NOT IN (:...closed)', {
        closed: [MaintenanceStatus.COMPLETED, MaintenanceStatus.CANCELLED],
      })
      .groupBy('mr.priority')
      .getRawMany();

    const costs = await this.maintenanceRepository
      .createQueryBuilder('mr')
      .innerJoin('mr.unit', 'unit')
      .innerJoin('unit.property', 'property')
      .select('SUM(mr.estimated_cost)', 'total_estimated')
      .addSelect('SUM(mr.actual_cost)', 'total_actual')
      .where('property.ownerId = :ownerId', { ownerId: user.id })
      .getRawOne();

    const statusMap: Record<string, number> = {
      open: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const row of byStatus) {
      statusMap[row.status] = parseInt(row.count) || 0;
    }

    const priorityMap: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    for (const row of byPriority) {
      priorityMap[row.priority] = parseInt(row.count) || 0;
    }

    return {
      byStatus: statusMap,
      openByPriority: priorityMap,
      costs: {
        totalEstimated: parseFloat(costs.total_estimated) || 0,
        totalActual: parseFloat(costs.total_actual) || 0,
      },
    };
  }
}
