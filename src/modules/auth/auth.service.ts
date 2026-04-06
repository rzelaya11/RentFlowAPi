import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@/modules/users/entities/user.entity';
import { PasswordReset } from './entities/password-reset.entity';
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PasswordReset)
    private readonly passwordResetRepository: Repository<PasswordReset>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Create user
    const user = this.userRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });

    await this.userRepository.save(user);

    // Generate tokens
    return this.generateAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase(), isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateAuthResponse(user);
  }

  async refreshToken(userId: string): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateAuthResponse(user);
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const message = 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña';

    const user = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase(), isActive: true },
    });

    // Always return 200 — never reveal whether the email exists
    if (!user) {
      return { message };
    }

    // Rate limiting: max 3 requests per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.passwordResetRepository
      .createQueryBuilder('pr')
      .where('pr.userId = :userId', { userId: user.id })
      .andWhere('pr.createdAt > :oneHourAgo', { oneHourAgo })
      .getCount();

    if (recentCount >= 3) {
      this.logger.warn(`Rate limit exceeded for forgot-password: userId=${user.id}`);
      return { message };
    }

    // Invalidate all previous unused tokens for this user
    await this.passwordResetRepository
      .createQueryBuilder()
      .update(PasswordReset)
      .set({ usedAt: new Date() })
      .where('user_id = :userId', { userId: user.id })
      .andWhere('used_at IS NULL')
      .execute();

    // Generate a secure random token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const reset = this.passwordResetRepository.create({ userId: user.id, token, expiresAt });
    await this.passwordResetRepository.save(reset);

    // Build reset link and send email
    const frontendUrl =
      this.configService.get<string>('mail.frontendUrl') ?? 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Restablecer contraseña — RentFlow',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <h2 style="color:#4F46E5;">Restablecer contraseña</h2>
          <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en RentFlow.</p>
          <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 24px;background-color:#4F46E5;
                    color:#fff;text-decoration:none;border-radius:6px;margin:16px 0;">
            Restablecer contraseña
          </a>
          <p style="color:#6B7280;font-size:14px;">
            Este enlace expira en <strong>1 hora</strong>.
          </p>
          <p style="color:#6B7280;font-size:14px;">
            Si no solicitaste este cambio, puedes ignorar este correo de forma segura.
          </p>
          <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;"/>
          <p style="color:#9CA3AF;font-size:12px;">RentFlow — Sistema de Gestión de Rentas</p>
        </div>
      `,
    });

    return { message };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    // Find a valid, unused, non-expired token
    const reset = await this.passwordResetRepository
      .createQueryBuilder('pr')
      .innerJoinAndSelect('pr.user', 'user')
      .where('pr.token = :token', { token: dto.token })
      .andWhere('pr.usedAt IS NULL')
      .andWhere('pr.expiresAt > :now', { now: new Date() })
      .getOne();

    if (!reset) {
      this.logger.warn(
        `Invalid or expired password reset attempt: token=${dto.token.substring(0, 8)}...`,
      );
      throw new BadRequestException('Token inválido o expirado');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Update user's password
    await this.userRepository.update(reset.userId, { passwordHash });

    // Mark token as consumed (single-use)
    reset.usedAt = new Date();
    await this.passwordResetRepository.save(reset);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  private generateAuthResponse(user: User): AuthResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret') ?? 'default-secret',
      expiresIn: (this.configService.get<string>('jwt.expiration') ?? '24h') as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret') ?? 'default-refresh-secret',
      expiresIn: (this.configService.get<string>('jwt.refreshExpiration') ?? '7d') as any,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }
}
