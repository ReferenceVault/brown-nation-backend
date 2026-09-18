-- AlterTable
ALTER TABLE "products" ADD COLUMN     "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "product_ratings" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_ratings_productId_idx" ON "product_ratings"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_ratings_productId_userId_key" ON "product_ratings"("productId", "userId");

-- AddForeignKey
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
