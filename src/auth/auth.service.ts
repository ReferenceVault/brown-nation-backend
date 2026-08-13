import { randomBytes, randomUUID } from 'node:crypto';

import { HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import ms from 'ms';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { JwtConfig } from '../config/configuration';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { SafeUser, UsersService } from '../users/users.service';
import { AuthTokens, JwtAccessPayload, JwtRefreshPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {
    this.jwtConfig = this.configService.get<JwtConfig>('jwt')!;
  }

  async signup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const existing = await this.usersService.findByEmailWithCredentials(data.email);
    if (existing) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'An account with this email already exists',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });

    const user = await this.usersService.createUser({
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });

    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role });
    this.logger.log(`New user signed up: ${user.id}`);
    return { user, tokens };
  }

  async login(email: string, password: string): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await this.usersService.findByEmailWithCredentials(email);
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Your account is not active. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    const tokens = await this.issueTokens({ id: user.id, email: user.email, role: user.role });
    this.logger.log(`User logged in: ${user.id}`);
    return { user: this.toSafeUser(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.jwtConfig.refreshSecret,
      });
    } catch {
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const user = await this.usersService.findByIdWithCredentials(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const matches = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!matches) {
      // Possible token reuse/theft: revoke the session defensively.
      await this.usersService.setRefreshTokenHash(user.id, null);
      throw new AppException(
        ErrorCode.INVALID_REFRESH_TOKEN,
        'Invalid or expired refresh token',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Your account is not active. Please contact support.',
        HttpStatus.FORBIDDEN,
      );
    }

    // Rotate the refresh token on every use.
    return this.issueTokens({ id: user.id, email: user.email, role: user.role });
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmailWithCredentials(email);

    // Always behave the same way whether or not the account exists, to avoid
    // leaking which emails are registered.
    if (!user) {
      return;
    }

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawSecret = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(rawSecret, { type: argon2.argon2id });
    const expiresAt = new Date(
      Date.now() + this.jwtConfig.passwordResetTokenTtlMinutes * 60 * 1000,
    );

    const record = await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const compositeToken = `${record.id}.${rawSecret}`;
    await this.emailService.sendPasswordResetEmail(user.email, compositeToken);
  }

  async resetPassword(compositeToken: string, newPassword: string): Promise<void> {
    const [recordId, rawSecret] = compositeToken.split('.');
    if (!recordId || !rawSecret) {
      throw new AppException(
        ErrorCode.INVALID_RESET_TOKEN,
        'Invalid or expired reset token',
        HttpStatus.BAD_REQUEST,
      );
    }

    const record = await this.prisma.passwordResetToken.findUnique({ where: { id: recordId } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new AppException(
        ErrorCode.INVALID_RESET_TOKEN,
        'Invalid or expired reset token',
        HttpStatus.BAD_REQUEST,
      );
    }

    const matches = await argon2.verify(record.tokenHash, rawSecret);
    if (!matches) {
      throw new AppException(
        ErrorCode.INVALID_RESET_TOKEN,
        'Invalid or expired reset token',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash, refreshTokenHash: null },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    this.logger.log(`Password reset completed for user: ${record.userId}`);
  }

  private async issueTokens(user: {
    id: string;
    email: string;
    role: User['role'];
  }): Promise<AuthTokens> {
    const accessPayload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: randomUUID(),
    };
    // A fresh jti guarantees uniqueness even when tokens are re-issued within
    // the same second, which otherwise produces byte-identical JWTs.
    const refreshPayload: JwtRefreshPayload = { sub: user.id, jti: randomUUID() };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.jwtConfig.accessSecret,
        expiresIn: Math.floor(ms(this.jwtConfig.accessExpiresIn as ms.StringValue) / 1000),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.jwtConfig.refreshSecret,
        expiresIn: Math.floor(ms(this.jwtConfig.refreshExpiresIn as ms.StringValue) / 1000),
      }),
    ]);

    const refreshTokenHash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  private toSafeUser(user: User): SafeUser {
    const { passwordHash: _passwordHash, refreshTokenHash: _refreshTokenHash, ...safe } = user;
    return safe;
  }
}
