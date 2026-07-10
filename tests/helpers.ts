import { db } from "@/lib/db";

/**
 * Reset the test database to a clean, seeded baseline. Truncates everything,
 * then recreates the MVP fixtures (2 garri SKUs, warehouse, supplier, accounts).
 * Integration test files run sequentially (vitest fileParallelism: false).
 */
export async function resetDb() {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      demand_events, notification_logs, refunds, inventory_txns, order_lines,
      orders, cycles, subscriptions, lots, po_lines, purchase_orders,
      transfer_orders, forecasts, price_book_entries, price_books,
      wholesale_leads, suppliers, warehouses, accounts, "_SkuSubstitutes", skus
    RESTART IDENTITY CASCADE
  `);

  const white = await db.sku.create({
    data: {
      code: "GAR-WHT-IJEBU",
      nameEn: "Premium White Garri (Ijebu)",
      localNames: ["Garri", "Gari", "Ijebu Garri"],
      brand: "GAARII",
      category: "GRAINS_FLOURS",
      perishability: "SHELF_STABLE",
      originCountry: "NG",
      unitSize: "1 lb",
      unitWeightGrams: 454,
      halal: true,
      shelfLifeDays: 365,
      active: true,
    },
  });
  const yellow = await db.sku.create({
    data: {
      code: "GAR-YEL",
      nameEn: "Premium Yellow Garri",
      localNames: ["Garri", "Gari", "Yellow Garri", "Garri Pupa"],
      brand: "GAARII",
      category: "GRAINS_FLOURS",
      perishability: "SHELF_STABLE",
      originCountry: "NG",
      unitSize: "1 lb",
      unitWeightGrams: 454,
      halal: true,
      shelfLifeDays: 365,
      active: true,
      substitutes: { connect: { id: white.id } },
    },
  });
  await db.sku.update({
    where: { id: white.id },
    data: { substitutes: { connect: { id: yellow.id } } },
  });

  const warehouse = await db.warehouse.create({
    data: { code: "HOU-1", name: "Houston 3PL", region: "US-CENTRAL" },
  });
  const supplier = await db.supplier.create({
    data: { name: "Ijebu Prime Processors", country: "NG" },
  });
  const household = await db.account.create({
    data: { email: "amara@test.gaarii", name: "Amara", role: "HOUSEHOLD" },
  });
  const admin = await db.account.create({
    data: { email: "admin@test.gaarii", name: "Admin", role: "ADMIN" },
  });

  return { white, yellow, warehouse, supplier, household, admin };
}
