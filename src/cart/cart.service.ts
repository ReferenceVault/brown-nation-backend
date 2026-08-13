import { HttpStatus, Injectable } from '@nestjs/common';
import { Cart, CartItem, Prisma, Product, ProductStatus } from '@prisma/client';

import { ErrorCode } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { PrismaService } from '../database/prisma.service';

type CartWithItems = Cart & { items: (CartItem & { product: Product })[] };

export interface CartItemView {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  price: string;
  quantity: number;
  stockQuantity: number;
  lineTotal: string;
}

export interface CartView {
  id: string;
  items: CartItemView[];
  subtotal: string;
  totalItems: number;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    return this.toCartView(cart);
  }

  async addItem(userId: string, productId: string, quantity: number): Promise<CartView> {
    const product = await this.getSellableProduct(productId);
    const cart = await this.getOrCreateCart(userId);

    const existing = cart.items.find((item) => item.productId === productId);
    const requestedTotal = (existing?.quantity ?? 0) + quantity;

    if (requestedTotal > product.stockQuantity) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_STOCK,
        `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
        HttpStatus.CONFLICT,
      );
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: requestedTotal },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number): Promise<CartView> {
    const item = await this.getOwnedItem(userId, itemId);
    const product = await this.getSellableProduct(item.productId);

    if (quantity > product.stockQuantity) {
      throw new AppException(
        ErrorCode.INSUFFICIENT_STOCK,
        `Only ${product.stockQuantity} unit(s) of "${product.name}" are available`,
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string): Promise<CartView> {
    const item = await this.getOwnedItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<CartView> {
    const cart = await this.getOrCreateCart(userId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(userId);
  }

  private async getOrCreateCart(userId: string): Promise<CartWithItems> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true }, orderBy: { createdAt: 'asc' } } },
    });

    if (cart) {
      return cart;
    }

    return this.prisma.cart.create({
      data: { userId },
      include: { items: { include: { product: true } } },
    });
  }

  private async getOwnedItem(userId: string, itemId: string): Promise<CartItem> {
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== userId) {
      throw new AppException(
        ErrorCode.CART_ITEM_NOT_FOUND,
        'Cart item not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return item;
  }

  private async getSellableProduct(productId: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new AppException(
        ErrorCode.PRODUCT_NOT_FOUND,
        'Product not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (product.status !== ProductStatus.ACTIVE) {
      throw new AppException(
        ErrorCode.PRODUCT_NOT_ACTIVE,
        'This product is not currently available',
        HttpStatus.BAD_REQUEST,
      );
    }
    return product;
  }

  private toCartView(cart: CartWithItems): CartView {
    const items: CartItemView[] = cart.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      slug: item.product.slug,
      image: item.product.images[0] ?? null,
      price: item.product.price.toString(),
      quantity: item.quantity,
      stockQuantity: item.product.stockQuantity,
      lineTotal: item.product.price.times(item.quantity).toString(),
    }));

    const subtotal = cart.items
      .reduce(
        (sum, item) => sum.plus(item.product.price.times(item.quantity)),
        new Prisma.Decimal(0),
      )
      .toString();

    return {
      id: cart.id,
      items,
      subtotal,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }
}
