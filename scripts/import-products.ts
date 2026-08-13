import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CategoryStatus, PrismaClient, ProductStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface ProductJson {
  name: string;
  slug: string;
  sku: string;
  price: number | null;
  category: string;
  description: string;
  otherInfo: {
    barPrice: number | null;
    bitesPrice: string | null;
    notes: string | null;
    priceOnRequest: boolean;
  };
  images: string[];
  stockQuantity: number;
}

interface CategoryJson {
  name: string;
  slug: string;
  subtitle: string | null;
  description: string;
  image: string;
}

interface CatalogJson {
  categories: CategoryJson[];
  products: ProductJson[];
}

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

function toUploadUrl(filename: string): string {
  return `${appUrl.replace(/\/$/, '')}/uploads/products/${filename}`;
}

// The source text file prefixes each blurb with a raw "Content-" label (an
// artifact of how the business shared copy, not customer-facing wording).
function buildDescription(product: ProductJson): string {
  const lines = [product.description.replace(/^content\s*-\s*/i, '')];
  if (product.otherInfo.bitesPrice) {
    lines.push(`Bites price: ₹${product.otherInfo.bitesPrice}`);
  }
  if (product.otherInfo.priceOnRequest) {
    lines.push('Price: On request');
  }
  if (product.otherInfo.notes) {
    lines.push(`Note: ${product.otherInfo.notes}`);
  }
  return lines.join('\n\n');
}

async function main(): Promise<void> {
  const catalogPath = join(__dirname, '..', 'products', 'products.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf-8')) as CatalogJson;

  console.log(`Importing ${catalog.categories.length} categories and ${catalog.products.length} products...`);

  const categoryIdByName = new Map<string, string>();

  for (const category of catalog.categories) {
    const created = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        image: toUploadUrl(category.image),
        status: CategoryStatus.ACTIVE,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: toUploadUrl(category.image),
        status: CategoryStatus.ACTIVE,
      },
    });
    categoryIdByName.set(category.name, created.id);
  }

  for (const product of catalog.products) {
    const categoryId = categoryIdByName.get(product.category);
    if (!categoryId) {
      throw new Error(`Unknown category "${product.category}" for product "${product.name}"`);
    }

    const images = product.images.map((_, index) => {
      // Filenames were normalized to "<slug>.jpg" / "<slug>-2.jpg" when copied into uploads/products.
      const suffix = index === 0 ? '' : `-${index + 1}`;
      return toUploadUrl(`${product.slug}${suffix}.jpg`);
    });

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        description: buildDescription(product),
        price: product.otherInfo.priceOnRequest ? 0 : (product.price ?? 0),
        sku: product.sku,
        images,
        categoryId,
        status: ProductStatus.ACTIVE,
        stockQuantity: product.stockQuantity,
      },
      create: {
        name: product.name,
        slug: product.slug,
        description: buildDescription(product),
        price: product.otherInfo.priceOnRequest ? 0 : (product.price ?? 0),
        sku: product.sku,
        images,
        categoryId,
        status: ProductStatus.ACTIVE,
        stockQuantity: product.stockQuantity,
      },
    });
  }

  console.log('Import complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
