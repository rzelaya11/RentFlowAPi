import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { Lease } from './entities/lease.entity';
import { Unit } from '@/modules/units/entities/unit.entity';
import { Tenant } from '@/modules/tenants/entities/tenant.entity';
import { Payment } from '@/modules/payments/entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Lease, Unit, Tenant, Payment])],
  controllers: [LeasesController],
  providers: [LeasesService],
  exports: [LeasesService],
})
export class LeasesModule {}
