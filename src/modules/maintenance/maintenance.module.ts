import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRequest } from './entities/maintenance-request.entity';
import { Unit } from '@/modules/units/entities/unit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceRequest, Unit])],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
