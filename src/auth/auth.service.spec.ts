import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn(async (value: string) => `hashed:${value}`),
  verify: jest.fn(async (hash: string, plain: string) => hash === `hashed:${plain}`),
  argon2id: 'argon2id',
}));

const JWT_CONFIG = {
  accessSecret: 'access-secret',
  refreshSecret: 'refresh-secret',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
  passwordResetTokenTtlMinutes: 30,
  emailVerificationTokenTtlMinutes: 1440,
};

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'hashed:CorrectPass123',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: null,
    role: UserRole.CUSTOMER,
    status: UserStatus.ACTIVE,
    isEmailVerified: false,
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let usersService: {
    findByEmailWithCredentials: jest.Mock;
    findByIdWithCredentials: jest.Mock;
    createUser: jest.Mock;
    setRefreshTokenHash: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let prisma: {
    passwordResetToken: Record<string, jest.Mock>;
    emailVerificationToken: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let emailService: { sendPasswordResetEmail: jest.Mock; sendVerificationEmail: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmailWithCredentials: jest.fn(),
      findByIdWithCredentials: jest.fn(),
      createUser: jest.fn(),
      setRefreshTokenHash: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verifyAsync: jest.fn(),
    };
    prisma = {
      passwordResetToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emailVerificationToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'verify-record-id' }),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
      $transaction: jest.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg)),
    };
    emailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn().mockReturnValue(JWT_CONFIG),
    } as unknown as ConfigService;

    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService,
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
    );
  });

  describe('signup', () => {
    it('rejects when the email is already registered', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(buildUser());

      await expect(
        service.signup({
          email: 'jane@example.com',
          password: 'CorrectPass123',
          firstName: 'Jane',
          lastName: 'Doe',
        }),
      ).rejects.toBeInstanceOf(AppException);

      expect(usersService.createUser).not.toHaveBeenCalled();
    });

    it('hashes the password and issues a token pair for a new user', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue(buildUser());

      const result = await service.signup({
        email: 'jane@example.com',
        password: 'CorrectPass123',
        firstName: 'Jane',
        lastName: 'Doe',
      });

      expect(argon2.hash).toHaveBeenCalledWith('CorrectPass123', { type: 'argon2id' });
      expect(result.tokens.accessToken).toBe('signed-token');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', expect.any(String));
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'jane@example.com',
        expect.stringContaining('verify-record-id.'),
      );
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(null);

      await expect(service.login('nobody@example.com', 'whatever')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('rejects an incorrect password', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(buildUser());

      await expect(service.login('jane@example.com', 'WrongPassword1')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('rejects a suspended account even with the correct password', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(
        buildUser({ status: UserStatus.SUSPENDED }),
      );

      await expect(service.login('jane@example.com', 'CorrectPass123')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('issues tokens for a correct password on an active account', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(buildUser());

      const result = await service.login('jane@example.com', 'CorrectPass123');

      expect(result.user.email).toBe('jane@example.com');
      expect(result.tokens.accessToken).toBe('signed-token');
    });
  });

  describe('refresh', () => {
    it('rejects a token that fails JWT verification', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(service.refresh('garbage-token')).rejects.toBeInstanceOf(AppException);
    });

    it('rejects and revokes when the token does not match the stored hash (reuse/theft)', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findByIdWithCredentials.mockResolvedValue(
        buildUser({ refreshTokenHash: 'hashed:some-other-token' }),
      );

      await expect(service.refresh('stolen-token')).rejects.toBeInstanceOf(AppException);
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
    });

    it('rotates the refresh token when it matches the stored hash', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      usersService.findByIdWithCredentials.mockResolvedValue(
        buildUser({ refreshTokenHash: 'hashed:valid-refresh-token' }),
      );

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('signed-token');
      // Called once during setup mock resolution + once for rotation.
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', expect.any(String));
    });
  });

  describe('resetPassword', () => {
    it('rejects a malformed token', async () => {
      await expect(
        service.resetPassword('not-a-composite-token', 'NewPass123'),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects when the token record cannot be found', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('record-id.secret', 'NewPass123')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('rejects an already-used token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'record-id',
        userId: 'user-1',
        tokenHash: 'hashed:secret',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.resetPassword('record-id.secret', 'NewPass123')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'record-id',
        userId: 'user-1',
        tokenHash: 'hashed:secret',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.resetPassword('record-id.secret', 'NewPass123')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('resets the password and marks the token used when everything checks out', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'record-id',
        userId: 'user-1',
        tokenHash: 'hashed:secret',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.resetPassword('record-id.secret', 'NewPass123');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('rejects a malformed token', async () => {
      await expect(service.verifyEmail('not-a-composite-token')).rejects.toBeInstanceOf(
        AppException,
      );
    });

    it('rejects when the token record cannot be found', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verifyEmail('record-id.secret')).rejects.toBeInstanceOf(AppException);
    });

    it('rejects an already-used token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'record-id',
        userId: 'user-1',
        tokenHash: 'hashed:secret',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.verifyEmail('record-id.secret')).rejects.toBeInstanceOf(AppException);
    });

    it('rejects an expired token', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'record-id',
        userId: 'user-1',
        tokenHash: 'hashed:secret',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.verifyEmail('record-id.secret')).rejects.toBeInstanceOf(AppException);
    });

    it('marks the user verified and the token used when everything checks out', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'record-id',
        userId: 'user-1',
        tokenHash: 'hashed:secret',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await service.verifyEmail('record-id.secret');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { isEmailVerified: true },
      });
    });
  });

  describe('resendVerification', () => {
    it('does nothing for an unknown email', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(null);

      await service.resendVerification('nobody@example.com');

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('does nothing when the email is already verified', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(
        buildUser({ isEmailVerified: true }),
      );

      await service.resendVerification('jane@example.com');

      expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('sends a new verification email for an unverified account', async () => {
      usersService.findByEmailWithCredentials.mockResolvedValue(buildUser());

      await service.resendVerification('jane@example.com');

      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        'jane@example.com',
        expect.stringContaining('verify-record-id.'),
      );
    });
  });
});
