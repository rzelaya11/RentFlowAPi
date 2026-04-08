import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from '@/common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;
  const corsOrigins = configService.get<string[]>('app.corsOrigins');

  // CORS — must be before setGlobalPrefix so OPTIONS preflight requests are handled
  app.enableCors({
    origin: configService.get<string[]>('app.corsOrigins') || ['http://localhost:5173'],
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('RentFlow API')
    .setDescription(
      'API for RentFlow - Property Rental Management System. ' +
      'Manage properties, units, tenants, leases, payments, and maintenance.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication and authorization')
    .addTag('Properties', 'Property management')
    .addTag('Units', 'Unit management within properties')
    .addTag('Tenants', 'Tenant management')
    .addTag('Leases', 'Lease/contract management')
    .addTag('Payments', 'Payment tracking')
    .addTag('Maintenance', 'Maintenance request management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'RentFlow API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);

  logger.log(`🏠 RentFlow API running on: http://localhost:${port}`);
  logger.log(`📖 Swagger docs at: http://localhost:${port}/api/docs`);
  logger.log(`🌍 Environment: ${configService.get<string>('app.env')}`);
}

bootstrap();
