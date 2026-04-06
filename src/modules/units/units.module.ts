import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';
import { Unit } from './entities/unit.entity';
import { Property } from '@/modules/properties/entities/property.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Unit, Property])],
  controllers: [UnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
