// GAARII MVP seed — single-product subscription company.
// Seeds EXACTLY two sellable SKUs: Premium White Garri (Ijebu) and Premium
// Yellow Garri. Do not add other products here until Phase 2 graduation
// criteria are met (PRD §8) — the schema supports them; the MVP must not.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const GARRI_SKUS: {
  code: string;
  nameEn: string;
  localNames: string[];
  brand: string;
}[] = [
  {
    code: "GAR-WHT-IJEBU",
    nameEn: "Premium White Garri (Ijebu)",
    localNames: ["Garri", "Gari", "Ijebu Garri", "Garri Ijebu"],
    brand: "GAARII",
  },
  {
    code: "GAR-YEL",
    nameEn: "Premium Yellow Garri",
    localNames: ["Garri", "Gari", "Yellow Garri", "Garri Pupa"],
    brand: "GAARII",
  },
];

async function main() {
  for (const sku of GARRI_SKUS) {
    const data = {
      ...sku,
      category: "GRAINS_FLOURS" as const,
      perishability: "SHELF_STABLE" as const,
      originCountry: "NG",
      unitSize: "1 lb",
      unitWeightGrams: 454,
      halal: true,
      shelfLifeDays: 365,
      countryOfOriginLabel: "Product of Nigeria",
      active: true,
    };
    await db.sku.upsert({
      where: { code: sku.code },
      create: data,
      update: data,
    });
  }

  // Single-product MVP guarantee: no other SKU may remain sellable.
  const retired = await db.sku.updateMany({
    where: { code: { notIn: GARRI_SKUS.map((s) => s.code) } },
    data: { active: false },
  });

  // Fulfillment node + suppliers (2 vetted processors per variety spec)
  await db.warehouse.upsert({
    where: { code: "HOU-1" },
    create: { code: "HOU-1", name: "Houston 3PL", region: "US-CENTRAL" },
    update: {},
  });
  for (const name of ["Ijebu Prime Processors", "Lagos Golden Cassava"]) {
    const existing = await db.supplier.findFirst({ where: { name } });
    if (!existing) {
      await db.supplier.create({
        data: {
          name,
          country: "NG",
          contactEmail: `${name.split(" ")[0].toLowerCase()}@example.ng`,
        },
      });
    }
  }

  // Staff accounts for the warehouse/admin surfaces (dev-auth stub)
  await db.account.upsert({
    where: { email: "admin@gaarii.test" },
    create: { email: "admin@gaarii.test", name: "GAARII Admin", role: "ADMIN" },
    update: { role: "ADMIN" },
  });
  await db.account.upsert({
    where: { email: "warehouse@gaarii.test" },
    create: {
      email: "warehouse@gaarii.test",
      name: "GAARII Warehouse",
      role: "WAREHOUSE",
    },
    update: { role: "WAREHOUSE" },
  });

  const active = await db.sku.findMany({
    where: { active: true },
    select: { code: true, nameEn: true },
    orderBy: { code: "asc" },
  });
  console.log(
    `Seeded ${GARRI_SKUS.length} garri SKUs (${retired.count} non-garri SKUs deactivated). Active SKUs:`,
  );
  for (const s of active) console.log(`  ${s.code} — ${s.nameEn}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
