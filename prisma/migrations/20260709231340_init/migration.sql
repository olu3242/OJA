-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('HOUSEHOLD', 'STORE', 'RESTAURANT', 'COMMUNITY', 'WAREHOUSE', 'ADMIN');

-- CreateEnum
CREATE TYPE "NetTermsStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SkuCategory" AS ENUM ('GRAINS_FLOURS', 'TUBERS', 'OILS', 'DRIED_FISH_PROTEINS', 'SPICES_SEASONINGS', 'FRESH_PRODUCE', 'FROZEN');

-- CreateEnum
CREATE TYPE "PerishabilityClass" AS ENUM ('SHELF_STABLE', 'REFRIGERATED', 'FROZEN', 'FRESH');

-- CreateEnum
CREATE TYPE "PriceTier" AS ENUM ('RETAIL', 'MEMBER', 'WHOLESALE');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "b2bVerified" BOOLEAN NOT NULL DEFAULT false,
    "b2bVerifiedAt" TIMESTAMP(3),
    "netTermsStatus" "NetTermsStatus" NOT NULL DEFAULT 'NONE',
    "deliveryZone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "localNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "SkuCategory" NOT NULL,
    "perishability" "PerishabilityClass" NOT NULL,
    "brand" TEXT,
    "originCountry" TEXT NOT NULL,
    "unitSize" TEXT NOT NULL,
    "unitWeightGrams" INTEGER,
    "halal" BOOLEAN NOT NULL DEFAULT false,
    "shelfLifeDays" INTEGER,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countryOfOriginLabel" TEXT,
    "fdaLabelingNotes" TEXT,
    "importPermitRequired" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_books" (
    "id" TEXT NOT NULL,
    "tier" "PriceTier" NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_book_entries" (
    "id" TEXT NOT NULL,
    "priceBookId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_book_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SkuSubstitutes" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_SkuSubstitutes_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "accounts_role_idx" ON "accounts"("role");

-- CreateIndex
CREATE UNIQUE INDEX "skus_code_key" ON "skus"("code");

-- CreateIndex
CREATE INDEX "skus_category_idx" ON "skus"("category");

-- CreateIndex
CREATE INDEX "skus_active_idx" ON "skus"("active");

-- CreateIndex
CREATE INDEX "price_books_tier_active_idx" ON "price_books"("tier", "active");

-- CreateIndex
CREATE UNIQUE INDEX "price_book_entries_priceBookId_skuId_minQty_key" ON "price_book_entries"("priceBookId", "skuId", "minQty");

-- CreateIndex
CREATE INDEX "_SkuSubstitutes_B_index" ON "_SkuSubstitutes"("B");

-- AddForeignKey
ALTER TABLE "price_book_entries" ADD CONSTRAINT "price_book_entries_priceBookId_fkey" FOREIGN KEY ("priceBookId") REFERENCES "price_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_book_entries" ADD CONSTRAINT "price_book_entries_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SkuSubstitutes" ADD CONSTRAINT "_SkuSubstitutes_A_fkey" FOREIGN KEY ("A") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SkuSubstitutes" ADD CONSTRAINT "_SkuSubstitutes_B_fkey" FOREIGN KEY ("B") REFERENCES "skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
