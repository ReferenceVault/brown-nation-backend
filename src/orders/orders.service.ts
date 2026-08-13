import { randomBytes } from 'node:crypto';

import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import {
  InventoryChangeReason,
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
  UserRole,
} from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { isTransitionAllowed, STOCK_RELEASABLE_STATUSES } from './order-status-transitions';

const FREE_SHIPPING_THRESHOLD = new Prisma.Decimal(999);
const FLAT_SHIPPING_FEE = new Prisma.Decimal(99);
const TRANSACTION_TIMEOUT_MS = 15_000;

const ORDER_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} satisfies Prisma.UserSelect;

const ORDER_INCLUDE = {
  items: true,
  statusHistory: { orderBy: { createdAt: 'asc' } as const },
  user: { select: ORDER_USER_SELECT },
} satisfies Prisma.OrderInclude;

const ORDER_LIST_INCLUDE = {
  user: { select: ORDER_USER_SELECT },
} satisfies Prisma.OrderInclude;

type OrderWithDetails = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;
type OrderListItem = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(userId: string, dto: CreateOrderDto): Promise<OrderWithDetails> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart || cart.items.length === 0) {
      throw new AppException(ErrorCode.CART_EMPTY, 'Your cart is empty', HttpStatus.BAD_REQUEST);
    }

    const cartItems = cart.items;
    const cartId = cart.id;

    return this.prisma.$transaction(
      async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: cartItems.map((item) => item.productId) } },
        });
        const productMap = new Map(products.map((product) => [product.id, product]));

        let subtotal = new Prisma.Decimal(0);
        const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = [];

        for (const cartItem of cartItems) {
          const product = productMap.get(cartItem.productId);
          if (!product || product.status !== ProductStatus.ACTIVE) {
            throw new AppException(
              ErrorCode.PRODUCT_NOT_ACTIVE,
              `"${product?.name ?? 'A product'}" in your cart is no longer available`,
              HttpStatus.BAD_REQUEST,
            );
          }

          const lineTotal = product.price.times(cartItem.quantity);
          subtotal = subtotal.plus(lineTotal);

          orderItemsData.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unitPrice: product.price,
            quantity: cartItem.quantity,
            totalPrice: lineTotal,
          });
        }

        const shippingAmount = subtotal.gte(FREE_SHIPPING_THRESHOLD)
          ? new Prisma.Decimal(0)
          : FLAT_SHIPPING_FEE;
        const taxAmount = new Prisma.Decimal(0);
        const discount = new Prisma.Decimal(0);
        const totalAmount = subtotal.minus(discount).plus(shippingAmount).plus(taxAmount);

        const order = await tx.order.create({
          data: {
            orderNumber: this.generateOrderNumber(),
            userId,
            status: OrderStatus.PENDING,
            subtotal,
            discount,
            shippingAmount,
            taxAmount,
            totalAmount,
            currency: 'INR',
            shippingAddress: { ...dto.shippingAddress },
            billingAddress: { ...(dto.billingAddress ?? dto.shippingAddress) },
            paymentStatus: PaymentStatus.PENDING,
            items: { createMany: { data: orderItemsData } },
            statusHistory: {
              create: { status: OrderStatus.PENDING, note: 'Order placed' },
            },
          },
        });

        for (const cartItem of cartItems) {
          await this.inventoryService.reserveStock(
            tx,
            cartItem.productId,
            cartItem.quantity,
            InventoryChangeReason.ORDER_PLACED,
            order.id,
          );
        }

        await tx.cartItem.deleteMany({ where: { cartId } });

        return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
      },
      // Default 5s is tight for this many sequential round-trips under load.
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  async findAll(
    requester: { id: string; role: UserRole },
    query: OrderQueryDto,
  ): Promise<{ items: OrderListItem[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(requester.role === UserRole.ADMIN ? {} : { userId: requester.id }),
      ...(query.status ? { status: query.status } : {}),
    };

    // Read-only listing — no need for transactional consistency between the
    // page of items and the total count, so run them in parallel instead of
    // paying serialized BEGIN/COMMIT round trips to the (remote) database.
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_LIST_INCLUDE,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total };
  }

  async findOne(
    requester: { id: string; role: UserRole },
    orderId: string,
  ): Promise<OrderWithDetails> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new AppException(ErrorCode.ORDER_NOT_FOUND, 'Order not found', HttpStatus.NOT_FOUND);
    }

    if (requester.role !== UserRole.ADMIN && order.userId !== requester.id) {
      throw new ForbiddenException('You may only access your own orders');
    }

    return order;
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    note?: string,
  ): Promise<OrderWithDetails> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!isTransitionAllowed(order.status, newStatus)) {
      throw new AppException(
        ErrorCode.INVALID_ORDER_STATUS_TRANSITION,
        `Cannot transition an order from ${order.status} to ${newStatus}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        if (
          newStatus === OrderStatus.CANCELLED &&
          STOCK_RELEASABLE_STATUSES.includes(order.status)
        ) {
          for (const item of order.items) {
            if (item.productId) {
              await this.inventoryService.releaseStock(
                tx,
                item.productId,
                item.quantity,
                InventoryChangeReason.ORDER_CANCELLED,
                order.id,
              );
            }
          }
        }

        await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });
        await tx.orderStatusHistory.create({ data: { orderId, status: newStatus, note } });

        return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE });
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );
  }

  private generateOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    return `BN-${date}-${suffix}`;
  }
}
