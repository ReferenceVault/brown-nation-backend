import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { UserRole } from '@prisma/client';
import request from 'supertest';

import { getPrisma } from './setup-app';

export interface AuthedUser {
  userId: string;
  accessToken: string;
}

/** Signs up a normal user via the public API, then promotes it to ADMIN directly in the DB. */
export async function createAdminUser(
  app: NestFastifyApplication,
  email: string,
): Promise<AuthedUser> {
  const signup = await request(app.getHttpServer()).post('/auth/signup').send({
    email,
    password: 'AdminPass123',
    firstName: 'Test',
    lastName: 'Admin',
  });

  const userId: string = signup.body.data.user.id;
  await getPrisma(app).user.update({ where: { id: userId }, data: { role: UserRole.ADMIN } });

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'AdminPass123' });

  return { userId, accessToken: login.body.data.tokens.accessToken };
}

export async function createCustomerUser(
  app: NestFastifyApplication,
  email: string,
): Promise<AuthedUser> {
  const signup = await request(app.getHttpServer()).post('/auth/signup').send({
    email,
    password: 'CustomerPass123',
    firstName: 'Test',
    lastName: 'Customer',
  });

  return {
    userId: signup.body.data.user.id,
    accessToken: signup.body.data.tokens.accessToken,
  };
}
