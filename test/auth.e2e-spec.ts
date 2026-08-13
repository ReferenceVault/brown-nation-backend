import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { EmailService } from '../src/email/email.service';
import { createTestApp, unique } from './utils/setup-app';

describe('Auth (e2e)', () => {
  let app: NestFastifyApplication;
  let capturedResetToken: string | undefined;

  const mockEmailService = {
    sendPasswordResetEmail: jest.fn(async (_to: string, token: string) => {
      capturedResetToken = token;
    }),
  };

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      builder.overrideProvider(EmailService).useValue(mockEmailService),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const email = unique('auth-e2e') + '@example.com';
  const password = 'StrongPass123';

  it('rejects a malformed signup payload with a structured validation error', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'not-an-email', password: 'short', firstName: 'A', lastName: 'B' })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });

  it('signs up a new user and returns a token pair, without leaking the password hash', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password, firstName: 'E2E', lastName: 'Tester' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(email);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a duplicate signup with the same email', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, password, firstName: 'E2E', lastName: 'Tester' })
      .expect(409);

    expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects login with a wrong password', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'WrongPassword1' })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in with correct credentials, then accesses /auth/me', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { accessToken } = login.body.data.tokens;

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.email).toBe(email);
  });

  it('rejects unauthenticated access to a protected route', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rotates the refresh token and invalidates the previous one', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const oldRefreshToken: string = login.body.data.tokens.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(200);

    expect(refreshed.body.data.refreshToken).not.toBe(oldRefreshToken);

    const reuse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    expect(reuse.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('logs out and revokes the session so the refresh token can no longer be used', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    const { accessToken, refreshToken } = login.body.data.tokens;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
  });

  it('completes the forgot-password -> reset-password flow end to end', async () => {
    await request(app.getHttpServer()).post('/auth/forgot-password').send({ email }).expect(200);

    expect(capturedResetToken).toEqual(expect.any(String));

    const newPassword = 'BrandNewPass456';
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: capturedResetToken, newPassword })
      .expect(200);

    await request(app.getHttpServer()).post('/auth/login').send({ email, password }).expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(200);

    // Single-use: replaying the same reset token must now fail.
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({ token: capturedResetToken, newPassword: 'Irrelevant123' })
      .expect(400);
  });
});
