-- CreateTable
CREATE TABLE "shipping_settings" (
    "id" TEXT NOT NULL,
    "flatFee" DECIMAL(10,2) NOT NULL,
    "freeThreshold" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("id")
);

-- Seed the single settings row with the previous env-var defaults.
INSERT INTO "shipping_settings" ("id", "flatFee", "freeThreshold", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 49.00, 999.00, CURRENT_TIMESTAMP);
