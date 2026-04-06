import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Property } from '@/modules/properties/entities/property.entity';
import { Unit } from '@/modules/units/entities/unit.entity';
import { Lease } from '@/modules/leases/entities/lease.entity';
import { Payment } from '@/modules/payments/entities/payment.entity';
import { MaintenanceRequest } from '@/modules/maintenance/entities/maintenance-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Property, Unit, Lease, Payment, MaintenanceRequest])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
