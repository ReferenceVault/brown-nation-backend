import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { createAdminUser, createCustomerUser } from './utils/admin';
import { createTestApp, unique } from './utils/setup-app';

describe('Products & Categories (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createAdminUser(app, unique('products-admin') + '@example.com');
    adminToken = admin.accessToken;
    const customer = await createCustomerUser(app, unique('products-customer') + '@example.com');
    customerToken = customer.accessToken;

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: unique('E2E Category') });
    categoryId = category.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks a non-admin from creating a product', async () => {
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Forbidden Product',
        description: 'desc',
        price: 10,
        sku: unique('SKU'),
        categoryId,
      })
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an admin create a product with an auto-derived slug', async () => {
    const name = 'Assam Special Reserve';
    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name,
        description: 'A special reserve blend',
        price: 250,
        sku: unique('SKU'),
        categoryId,
        status: 'ACTIVE',
        stockQuantity: 15,
      })
      .expect(201);

    expect(response.body.data.slug).toContain('assam-special-reserve');
    expect(response.body.data.price).toBe('250');
  });

  it('assigns a distinct slug when the name collides', async () => {
    const name = unique('Collision Tea');
    const sku1 = unique('SKU');
    const sku2 = unique('SKU');

    const first = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, description: 'd', price: 10, sku: sku1, categoryId })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name, description: 'd', price: 10, sku: sku2, categoryId })
      .expect(201);

    expect(first.body.data.slug).not.toBe(second.body.data.slug);
  });

  it('rejects a duplicate SKU with a structured 409', async () => {
    const sku = unique('SKU-DUP');
    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: unique('Product A'), description: 'd', price: 10, sku, categoryId })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: unique('Product B'), description: 'd', price: 10, sku, categoryId })
      .expect(409);

    expect(response.body.error.code).toBe('DUPLICATE_SKU');
  });

  it('lists products publicly with pagination metadata', async () => {
    const response = await request(app.getHttpServer())
      .get('/products')
      .query({ limit: 2, page: 1 })
      .expect(200);

    expect(response.body.data.items.length).toBeLessThanOrEqual(2);
    expect(response.body.data.meta).toMatchObject({ page: 1, limit: 2 });
  });

  it('fetches a product by slug', async () => {
    const created = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Slug Lookup Tea'),
        description: 'd',
        price: 10,
        sku: unique('SKU'),
        categoryId,
        status: 'ACTIVE',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/products/slug/${created.body.data.slug}`)
      .expect(200);

    expect(response.body.data.id).toBe(created.body.data.id);
  });

  it('returns a structured 404 for an unknown product id', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/00000000-0000-0000-0000-000000000000')
      .expect(404);

    expect(response.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
