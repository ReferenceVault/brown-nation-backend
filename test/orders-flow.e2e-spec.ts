import { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';

import { createAdminUser, createCustomerUser } from './utils/admin';
import { createTestApp, unique } from './utils/setup-app';

describe('Cart -> Order -> Payment -> Inventory (e2e)', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let customerToken: string;
  let categoryId: string;
  let productId: string;
  let orderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createAdminUser(app, unique('orders-admin') + '@example.com');
    adminToken = admin.accessToken;
    const customer = await createCustomerUser(app, unique('orders-customer') + '@example.com');
    customerToken = customer.accessToken;

    const category = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: unique('Order Flow Category') });
    categoryId = category.body.data.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Order Flow Tea'),
        description: 'Used to exercise the order flow',
        price: 100,
        sku: unique('SKU-FLOW'),
        categoryId,
        status: 'ACTIVE',
        stockQuantity: 5,
      });
    productId = product.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects adding more to the cart than is in stock', async () => {
    const response = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId, quantity: 999 })
      .expect(409);

    expect(response.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it('rejects adding a product to a cart without authentication', async () => {
    await request(app.getHttpServer())
      .post('/cart/items')
      .send({ productId, quantity: 1 })
      .expect(401);
  });

  it('adds an item to the cart using the live product price, not a client-supplied one', async () => {
    const response = await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      // Note: no price is sent by the client at all — it can only come from the DB.
      .send({ productId, quantity: 3 })
      .expect(201);

    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].price).toBe('100');
    expect(response.body.data.subtotal).toBe('300');
  });

  it('creates an order from the cart, snapshotting items and reserving stock atomically', async () => {
    const beforeProduct = await request(app.getHttpServer()).get(`/products/${productId}`);
    expect(beforeProduct.body.data.stockQuantity).toBe(5);

    const order = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shippingAddress: {
          fullName: 'Jane Doe',
          phone: '+919876543210',
          line1: '221B Baker Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
        },
      })
      .expect(201);

    expect(order.body.data.status).toBe('PENDING');
    expect(order.body.data.items).toHaveLength(1);
    expect(order.body.data.items[0]).toMatchObject({
      productId,
      quantity: 3,
      unitPrice: '100',
      totalPrice: '300',
    });
    expect(order.body.data.subtotal).toBe('300');

    const afterProduct = await request(app.getHttpServer()).get(`/products/${productId}`);
    expect(afterProduct.body.data.stockQuantity).toBe(2);

    const cart = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(cart.body.data.items).toHaveLength(0);

    orderId = order.body.data.id;
  });

  it('prevents a second customer from viewing the first customer order', async () => {
    const other = await createCustomerUser(app, unique('orders-other') + '@example.com');

    const response = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks a customer from transitioning order status directly', async () => {
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(403);
  });

  it('pays for the order via the mock provider and auto-confirms it', async () => {
    const payment = await request(app.getHttpServer())
      .post(`/payments/${orderId}/initiate`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(201);

    expect(payment.body.data.payment.status).toBe('SUCCESS');

    const order = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(order.body.data.status).toBe('CONFIRMED');
    expect(order.body.data.paymentStatus).toBe('SUCCESS');
  });

  it('lets an admin advance order status but rejects skipping a stage', async () => {
    const processing = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'PROCESSING' })
      .expect(200);
    expect(processing.body.data.status).toBe('PROCESSING');

    const invalid = await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DELIVERED' })
      .expect(400);
    expect(invalid.body.error.code).toBe('INVALID_ORDER_STATUS_TRANSITION');
  });

  it('releases reserved stock when an order is cancelled before shipping', async () => {
    // Fresh product/order pair so this test doesn't depend on prior stock state.
    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: unique('Cancel Flow Tea'),
        description: 'd',
        price: 50,
        sku: unique('SKU-CANCEL'),
        categoryId,
        status: 'ACTIVE',
        stockQuantity: 4,
      });
    const cancelProductId = product.body.data.id;

    await request(app.getHttpServer())
      .post('/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: cancelProductId, quantity: 4 })
      .expect(201);

    const order = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        shippingAddress: {
          fullName: 'Jane Doe',
          phone: '+919876543210',
          line1: '221B Baker Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
        },
      })
      .expect(201);

    const midProduct = await request(app.getHttpServer()).get(`/products/${cancelProductId}`);
    expect(midProduct.body.data.stockQuantity).toBe(0);

    await request(app.getHttpServer())
      .patch(`/orders/${order.body.data.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CANCELLED' })
      .expect(200);

    const restoredProduct = await request(app.getHttpServer()).get(`/products/${cancelProductId}`);
    expect(restoredProduct.body.data.stockQuantity).toBe(4);
  });

  it('rejects creating an order from an empty cart', async () => {
    const customer = await createCustomerUser(app, unique('orders-empty-cart') + '@example.com');

    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        shippingAddress: {
          fullName: 'Nobody',
          phone: '+919876543210',
          line1: 'Nowhere',
          city: 'Nowhere',
          state: 'Nowhere',
          postalCode: '000000',
        },
      })
      .expect(400);

    expect(response.body.error.code).toBe('CART_EMPTY');
  });
});
