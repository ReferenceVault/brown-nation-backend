import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User, UserRole, UserStatus } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  status: true,
  isEmailVerified: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<SafeUser> {
    return this.prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      },
      select: SAFE_USER_SELECT,
    });
  }

  /** Includes passwordHash/refreshTokenHash — for internal auth use only, never return via API. */
  async findByEmailWithCredentials(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  /** Includes passwordHash/refreshTokenHash — for internal auth use only, never return via API. */
  async findByIdWithCredentials(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findSafeById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async list(params: {
    skip: number;
    take: number;
    role?: UserRole;
  }): Promise<{ items: SafeUser[]; total: number }> {
    const where: Prisma.UserWhereInput = params.role ? { role: params.role } : {};

    // Read-only listing — see orders.service.ts's findAll for why this runs
    // in parallel instead of inside a $transaction.
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async updateProfile(
    id: string,
    data: { firstName?: string; lastName?: string; phone?: string },
  ): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  async updateAdmin(id: string, data: { role?: UserRole; status?: UserStatus }): Promise<SafeUser> {
    await this.findSafeById(id);
    return this.prisma.user.update({
      where: { id },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  /**
   * Deletes a user. Orders are either removed with the user (cascading to
   * their items/history/payments) or kept and unlinked (Order.userId -> null),
   * since Order retains its own denormalized snapshot (shippingAddress, item
   * name/sku/price) and doesn't need the user row to stay meaningful.
   */
  async deleteUser(id: string, deleteOrders: boolean): Promise<void> {
    await this.findSafeById(id);

    await this.prisma.$transaction(async (tx) => {
      if (deleteOrders) {
        await tx.order.deleteMany({ where: { userId: id } });
      } else {
        await tx.order.updateMany({ where: { userId: id }, data: { userId: null } });
      }
      await tx.user.delete({ where: { id } });
    });
  }

  async setRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { refreshTokenHash },
    });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, refreshTokenHash: null },
    });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { isEmailVerified: true } });
  }
}
