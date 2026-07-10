-- CreateEnum
CREATE TYPE "GroupOrderStatus" AS ENUM ('OPEN', 'CLOSED', 'FULFILLED');

-- AlterEnum
ALTER TYPE "AccountRole" ADD VALUE 'SUPPLIER';

-- AlterEnum
ALTER TYPE "DemandEventType" ADD VALUE 'SELL_THROUGH';

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'US';

-- AlterTable
ALTER TABLE "skus" ADD COLUMN     "cfiaLabelingNotes" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD';

-- CreateTable
CREATE TABLE "group_orders" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "GroupOrderStatus" NOT NULL DEFAULT 'OPEN',
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_order_members" (
    "id" TEXT NOT NULL,
    "groupOrderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "plan" "PlanTier" NOT NULL,
    "variety" "GarriVariety" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "qtyLbs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_order_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_orders_code_key" ON "group_orders"("code");

-- CreateIndex
CREATE UNIQUE INDEX "group_order_members_groupOrderId_accountId_key" ON "group_order_members"("groupOrderId", "accountId");

-- AddForeignKey
ALTER TABLE "group_order_members" ADD CONSTRAINT "group_order_members_groupOrderId_fkey" FOREIGN KEY ("groupOrderId") REFERENCES "group_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
