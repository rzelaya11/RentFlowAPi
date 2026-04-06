import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { appConfig, databaseConfig, jwtConfig, mailConfig } from '@/config/app.config';

// Modules
import { AuthModule } from '@/modules/auth/auth.module';
import { PropertiesModule } from '@/modules/properties/properties.module';
import { UnitsModule } from '@/modules/units/units.module';
import { TenantsModule } from '@/modules/tenants/tenants.module';
import { LeasesModule } from '@/modules/leases/leases.module';
import { PaymentsModule } from '@/modules/payments/payments.module';
import { MaintenanceModule } from '@/modules/maintenance/maintenance.module';
import { DashboardModule } from '@/modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, mailConfig],
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [__dirname + '/modules/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<boolean>('database.logging'),
      }),
    }),

    // Feature modules
    AuthModule,
    PropertiesModule,
    UnitsModule,
    TenantsModule,
    LeasesModule,
    PaymentsModule,
    MaintenanceModule,
    DashboardModule,
  ],
})
export class AppModule {}
