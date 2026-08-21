-- AlterTable
ALTER TABLE "products" ADD COLUMN     "contents" TEXT[] DEFAULT ARRAY[]::TEXT[];
