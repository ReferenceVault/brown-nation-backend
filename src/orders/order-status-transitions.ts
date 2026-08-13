import { OrderStatus } from '@prisma/client';

/** Allowed forward transitions for an order's lifecycle. */
export const ALLOWED_ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** Statuses at which stock has been reserved but not yet shipped out. */
export const STOCK_RELEASABLE_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
];

export function isTransitionAllowed(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return ALLOWED_ORDER_STATUS_TRANSITIONS[from].includes(to);
}
