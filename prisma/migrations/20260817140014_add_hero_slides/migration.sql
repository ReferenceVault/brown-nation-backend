-- CreateEnum
CREATE TYPE "HeroSlideStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "hero_slides" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "headingLine1" TEXT NOT NULL,
    "headingLine2" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "primaryCtaLabel" TEXT NOT NULL DEFAULT 'Shop Now',
    "primaryCtaHref" TEXT NOT NULL DEFAULT '/shop',
    "secondaryCtaLabel" TEXT NOT NULL DEFAULT 'Explore Flavors',
    "secondaryCtaHref" TEXT NOT NULL DEFAULT '/shop',
    "image" TEXT NOT NULL,
    "paletteFrom" TEXT NOT NULL DEFAULT '#f8ece5',
    "paletteTo" TEXT NOT NULL DEFAULT '#eddcd0',
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "HeroSlideStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hero_slides_status_idx" ON "hero_slides"("status");
