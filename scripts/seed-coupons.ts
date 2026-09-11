import { CouponDiscountType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding example coupons...');

  const coupons = [
    {
      code: 'WELCOME10',
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
    },
    {
      code: 'SWEET15',
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 15,
      minOrderAmount: 999,
    },
    {
      code: 'FLAT100',
      discountType: CouponDiscountType.FIXED_AMOUNT,
      discountValue: 100,
      minOrderAmount: 500,
    },
  ];

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: coupon,
    });
    console.log(`  ${coupon.code}`);
  }

  console.log('Done.');
}

main()
  .catch((error: unknown) => {
    console.error('Seeding example coupons failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
