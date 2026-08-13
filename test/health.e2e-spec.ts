import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { createTestApp } from './utils/setup-app';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health reports the app and database as up, unwrapped', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    // Health checks are excluded from the { success, data } envelope so
    // infra probes can read the raw Terminus payload directly.
    expect(response.body).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
    });
    expect(response.body.success).toBeUndefined();
  });
});
