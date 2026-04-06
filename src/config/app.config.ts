import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.APP_PORT || '3000', 10) || 3000,
  env: process.env.APP_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
}));

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10) || 5432,
  username: process.env.DB_USERNAME || 'rentflow',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'rentflow_db',
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'default-secret-change-me',
  expiration: process.env.JWT_EXPIRATION || '24h',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-change-me',
  refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));

export const mailConfig = registerAs('mail', () => ({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  user: process.env.MAIL_USER || '',
  password: process.env.MAIL_PASSWORD || '',
  from: process.env.MAIL_FROM || '"RentFlow" <noreply@rentflow.hn>',
  frontendUrl: process.env.APP_FRONTEND_URL || 'http://localhost:5173',
}));
