-- CreateEnum
CREATE TYPE "VariantKind" AS ENUM ('CAVITY', 'HAMPER');

-- DropIndex
DROP INDEX "product_variants_productId_cavityCount_key";

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "kind" "VariantKind" NOT NULL DEFAULT 'CAVITY',
ADD COLUMN     "label" TEXT,
ALTER COLUMN "cavityCount" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_kind_cavityCount_key" ON "product_variants"("productId", "kind", "cavityCount");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_productId_kind_label_key" ON "product_variants"("productId", "kind", "label");
