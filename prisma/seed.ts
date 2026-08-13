import { CategoryStatus, PrismaClient, ProductStatus, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminPasswordHash = await argon2.hash('AdminPass123', { type: argon2.argon2id });
  const customerPasswordHash = await argon2.hash('CustomerPass123', { type: argon2.argon2id });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@brownnation.com' },
    update: {},
    create: {
      email: 'admin@brownnation.com',
      passwordHash: adminPasswordHash,
      firstName: 'Brown',
      lastName: 'Admin',
      role: UserRole.ADMIN,
      isEmailVerified: true,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@brownnation.com' },
    update: {},
    create: {
      email: 'customer@brownnation.com',
      passwordHash: customerPasswordHash,
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '+919876543210',
      role: UserRole.CUSTOMER,
      isEmailVerified: true,
    },
  });

  const categories = await Promise.all(
    [
      {
        name: 'Herbal Teas',
        slug: 'herbal-teas',
        description: 'Caffeine-free infusions blended from herbs, flowers and spices.',
        status: CategoryStatus.ACTIVE,
      },
      {
        name: 'Black Teas',
        slug: 'black-teas',
        description: 'Full-bodied, robust teas from the finest estates.',
        status: CategoryStatus.ACTIVE,
      },
      {
        name: 'Green Teas',
        slug: 'green-teas',
        description: 'Lightly oxidized teas with a fresh, grassy character.',
        status: CategoryStatus.ACTIVE,
      },
    ].map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: {},
        create: category,
      }),
    ),
  );

  const [herbal, black, green] = categories;

  const products = [
    {
      name: 'Chamomile Dream',
      slug: 'chamomile-dream',
      description: 'Soothing chamomile flowers blended with lavender and honey notes.',
      price: 349.0,
      compareAtPrice: 399.0,
      sku: 'TEA-HRB-001',
      images: ['https://placehold.co/600x600?text=Chamomile+Dream'],
      categoryId: herbal.id,
      status: ProductStatus.ACTIVE,
      stockQuantity: 120,
    },
    {
      name: 'Tulsi Ginger Warmth',
      slug: 'tulsi-ginger-warmth',
      description: 'Holy basil and ginger root, a classic Indian herbal comfort blend.',
      price: 299.0,
      sku: 'TEA-HRB-002',
      images: ['https://placehold.co/600x600?text=Tulsi+Ginger'],
      categoryId: herbal.id,
      status: ProductStatus.ACTIVE,
      stockQuantity: 80,
    },
    {
      name: 'Assam Gold',
      slug: 'assam-gold',
      description: 'A robust, malty black tea from the Assam region, perfect with milk.',
      price: 499.0,
      compareAtPrice: 599.0,
      sku: 'TEA-BLK-001',
      images: ['https://placehold.co/600x600?text=Assam+Gold'],
      categoryId: black.id,
      status: ProductStatus.ACTIVE,
      stockQuantity: 200,
    },
    {
      name: 'Darjeeling First Flush',
      slug: 'darjeeling-first-flush',
      description: 'Delicate, floral and prized as the "champagne of teas".',
      price: 899.0,
      sku: 'TEA-BLK-002',
      images: ['https://placehold.co/600x600?text=Darjeeling'],
      categoryId: black.id,
      status: ProductStatus.ACTIVE,
      stockQuantity: 45,
    },
    {
      name: 'Jasmine Pearl Green',
      slug: 'jasmine-pearl-green',
      description: 'Hand-rolled green tea pearls scented with fresh jasmine blossoms.',
      price: 549.0,
      sku: 'TEA-GRN-001',
      images: ['https://placehold.co/600x600?text=Jasmine+Pearl'],
      categoryId: green.id,
      status: ProductStatus.ACTIVE,
      stockQuantity: 60,
    },
    {
      name: 'Sencha Classic',
      slug: 'sencha-classic',
      description: 'A traditional Japanese green tea with a clean, vegetal taste.',
      price: 399.0,
      sku: 'TEA-GRN-002',
      images: ['https://placehold.co/600x600?text=Sencha'],
      categoryId: green.id,
      status: ProductStatus.DRAFT,
      stockQuantity: 0,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
  }

  console.log('Seed complete:');
  console.log(`  Admin login:    ${admin.email} / AdminPass123`);
  console.log(`  Customer login: ${customer.email} / CustomerPass123`);
  console.log(`  Categories: ${categories.length}, Products: ${products.length}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
