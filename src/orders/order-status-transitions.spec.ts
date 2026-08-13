import { OrderStatus } from '@prisma/client';

import { isTransitionAllowed } from './order-status-transitions';

describe('isTransitionAllowed', () => {
  it('allows the standard forward lifecycle', () => {
    expect(isTransitionAllowed(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(isTransitionAllowed(OrderStatus.CONFIRMED, OrderStatus.PROCESSING)).toBe(true);
    expect(isTransitionAllowed(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).toBe(true);
    expect(isTransitionAllowed(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it('allows cancellation from any pre-shipment state', () => {
    expect(isTransitionAllowed(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(isTransitionAllowed(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    expect(isTransitionAllowed(OrderStatus.PROCESSING, OrderStatus.CANCELLED)).toBe(true);
  });

  it('rejects skipping stages', () => {
    expect(isTransitionAllowed(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
    expect(isTransitionAllowed(OrderStatus.PROCESSING, OrderStatus.DELIVERED)).toBe(false);
  });

  it('rejects transitions out of terminal states', () => {
    expect(isTransitionAllowed(OrderStatus.DELIVERED, OrderStatus.PENDING)).toBe(false);
    expect(isTransitionAllowed(OrderStatus.CANCELLED, OrderStatus.PENDING)).toBe(false);
  });

  it('rejects cancelling a shipped order', () => {
    expect(isTransitionAllowed(OrderStatus.SHIPPED, OrderStatus.CANCELLED)).toBe(false);
  });

  it('rejects a no-op transition', () => {
    expect(isTransitionAllowed(OrderStatus.PENDING, OrderStatus.PENDING)).toBe(false);
  });
});
