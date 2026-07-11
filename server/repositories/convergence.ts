import type { PoolClient } from "pg";
import { canonicalPool } from "@/lib/canonical-db";
import { db } from "@/lib/db";

/**
 * Convergence step 1 (production-readiness condition C5): idempotent backfill
 * of legacy Prisma commerce data into the canonical schema.
 *
 * Order of operations per legacy account:
 *   organization → customer → subscriptions (+items) → deliveries (cycles)
 *   → orders (+items), every row registered in legacy_map so re-runs are
 *   no-ops and nothing is ever duplicated or orphaned.
 */
export type ConvergenceReport = {
  organizations: number;
  customers: number;
  subscriptions: number;
  deliveries: number;
  orders: number;
  orderItems: number;
  skipped: number;
  orphans: string[];
};

async function mapGet(
  c: PoolClient,
  table: string,
  legacyId: string,
): Promise<string | null> {
  const r = await c.query(
    `select canonical_id from public.legacy_map where legacy_table=$1 and legacy_id=$2`,
    [table, legacyId],
  );
  return r.rows[0]?.canonical_id ?? null;
}

async function mapPut(
  c: PoolClient,
  legacyTable: string,
  legacyId: string,
  canonicalTable: string,
  canonicalId: string,
  organizationId: string | null,
) {
  await c.query(
    `insert into public.legacy_map (legacy_table, legacy_id, canonical_table, canonical_id, organization_id)
     values ($1,$2,$3,$4,$5) on conflict (legacy_table, legacy_id) do nothing`,
    [legacyTable, legacyId, canonicalTable, canonicalId, organizationId],
  );
}

const variantSkuFor = (variety: string) =>
  variety === "YELLOW" ? "GAR-YEL" : "GAR-WHT-IJEBU";

export async function convergeLegacyData(): Promise<ConvergenceReport> {
  const report: ConvergenceReport = {
    organizations: 0,
    customers: 0,
    subscriptions: 0,
    deliveries: 0,
    orders: 0,
    orderItems: 0,
    skipped: 0,
    orphans: [],
  };
  const c = await canonicalPool.connect();
  try {
    await c.query("begin");

    // Canonical product variants must exist (seeded in 0003).
    const variants = new Map<string, string>();
    for (const row of (
      await c.query(`select id, sku from public.product_variants`)
    ).rows) {
      variants.set(row.sku, row.id);
    }
    if (variants.size < 2)
      throw new Error(
        "Canonical catalog missing — run canonical:migrate first",
      );

    const accounts = await db.account.findMany({
      where: {
        role: { in: ["HOUSEHOLD", "STORE", "RESTAURANT", "COMMUNITY"] },
      },
      include: {
        subscriptions: { include: { cycles: true } },
        orders: { include: { lines: { include: { sku: true } } } },
      },
    });

    for (const account of accounts) {
      // 1) Organization (tenant) per legacy account -------------------------
      let orgId = await mapGet(c, "accounts_org", account.id);
      if (!orgId) {
        const kind =
          account.role === "STORE"
            ? "business"
            : account.role === "RESTAURANT"
              ? "restaurant"
              : account.role === "COMMUNITY"
                ? "group"
                : "household";
        const org = await c.query(
          `insert into public.organizations (name, slug, kind, country, onboarding_state)
           values ($1, $2 || '-' || substr(md5($3), 1, 8), $4, $5, 'complete') returning id`,
          [
            account.businessName ?? account.name,
            account.email
              .split("@")[0]
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .slice(0, 32) || "legacy",
            account.id,
            kind,
            account.deliveryZone &&
            ["ON", "QC", "BC", "AB", "NU", "NT", "YT"].includes(
              account.deliveryZone,
            )
              ? "CA"
              : "US",
          ],
        );
        orgId = org.rows[0].id as string;
        await mapPut(
          c,
          "accounts_org",
          account.id,
          "organizations",
          orgId,
          orgId,
        );
        report.organizations++;
        // If this account already signed in with Google, attach membership.
        const profile = await c.query(
          `select id from public.profiles where legacy_account_id = $1 or email = $2`,
          [account.id, account.email.toLowerCase()],
        );
        if (profile.rowCount) {
          await c.query(
            `insert into public.organization_members (organization_id, user_id, member_role, created_by)
             values ($1,$2,'owner',$2) on conflict (organization_id, user_id) do nothing`,
            [orgId, profile.rows[0].id],
          );
        }
      }

      // 2) Customer ----------------------------------------------------------
      let customerId = await mapGet(c, "accounts", account.id);
      if (!customerId) {
        const kind = account.role === "HOUSEHOLD" ? "household" : "business";
        const cust = await c.query(
          `insert into public.customers (organization_id, kind, display_name, email, phone)
           values ($1,$2,$3,lower($4),$5)
           on conflict (organization_id, email) do update set display_name = excluded.display_name
           returning id`,
          [orgId, kind, account.name, account.email, account.phone],
        );
        customerId = cust.rows[0].id as string;
        await mapPut(c, "accounts", account.id, "customers", customerId, orgId);
        report.customers++;
      }

      // 3) Subscriptions + items ----------------------------------------------
      for (const sub of account.subscriptions) {
        let subId = await mapGet(c, "subscriptions", sub.id);
        if (!subId) {
          const plan = sub.cadenceDays === 7 ? "WHOLESALE_STANDING" : sub.plan;
          const status =
            sub.status === "ACTIVE"
              ? "active"
              : sub.status === "PAUSED"
                ? "paused"
                : "cancelled";
          const row = await c.query(
            `insert into public.subscriptions
               (organization_id, customer_id, plan, status, cadence_days, currency, price_cents,
                paused_at, cancelled_at)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
            [
              orgId,
              customerId,
              plan,
              status,
              sub.cadenceDays,
              sub.currency,
              sub.priceCents,
              sub.pausedAt,
              sub.cancelledAt,
            ],
          );
          subId = row.rows[0].id as string;
          await c.query(
            `insert into public.subscription_items (organization_id, subscription_id, product_variant_id, qty, unit)
             values ($1,$2,$3,$4,'lb')`,
            [
              orgId,
              subId,
              variants.get(variantSkuFor(sub.variety)),
              sub.qtyLbs,
            ],
          );
          await mapPut(
            c,
            "subscriptions",
            sub.id,
            "subscriptions",
            subId,
            orgId,
          );
          report.subscriptions++;
        }

        // 4) Cycles → subscription_deliveries ---------------------------------
        for (const cycle of sub.cycles) {
          if (await mapGet(c, "cycles", cycle.id)) continue;
          const status = cycle.status.toLowerCase(); // enum sets match by design
          const row = await c.query(
            `insert into public.subscription_deliveries
               (organization_id, subscription_id, scheduled_for, status, confirmed_at)
             values ($1,$2,$3::date,$4,$5) returning id`,
            [orgId, subId, cycle.scheduledFor, status, cycle.confirmedAt],
          );
          await mapPut(
            c,
            "cycles",
            cycle.id,
            "subscription_deliveries",
            row.rows[0].id,
            orgId,
          );
          report.deliveries++;
        }
      }

      // 5) Orders + items ------------------------------------------------------
      for (const order of account.orders) {
        if (await mapGet(c, "orders", order.id)) {
          report.skipped++;
          continue;
        }
        const deliveryId = order.cycleId
          ? await mapGet(c, "cycles", order.cycleId)
          : null;
        const row = await c.query(
          `insert into public.orders
             (organization_id, customer_id, subscription_delivery_id, status, currency,
              subtotal_cents, total_cents, ship_line1, ship_city, ship_region,
              ship_postal_code, ship_country, created_at)
           values ($1,$2,$3,$4,'USD',$5,$5,$6,$7,$8,$9,$10,$11) returning id`,
          [
            orgId,
            customerId,
            deliveryId,
            order.status.toLowerCase(),
            order.totalCents,
            order.addressLine1,
            order.city,
            order.state,
            order.zip,
            order.country,
            order.createdAt,
          ],
        );
        const orderId = row.rows[0].id as string;
        if (deliveryId) {
          await c.query(
            `update public.subscription_deliveries set order_id = $2 where id = $1`,
            [deliveryId, orderId],
          );
        }
        for (const line of order.lines) {
          const variantId = variants.get(line.sku.code);
          if (!variantId) {
            report.orphans.push(
              `order_line ${line.id}: unknown sku ${line.sku.code}`,
            );
            continue;
          }
          const li = await c.query(
            `insert into public.order_items (organization_id, order_id, product_variant_id, qty, unit_price_cents)
             values ($1,$2,$3,$4,$5) returning id`,
            [orgId, orderId, variantId, line.qtyUnits, line.unitPriceCents],
          );
          await mapPut(
            c,
            "order_lines",
            line.id,
            "order_items",
            li.rows[0].id,
            orgId,
          );
          report.orderItems++;
        }
        await mapPut(c, "orders", order.id, "orders", orderId, orgId);
        report.orders++;
      }
    }

    // Orphan audit: every canonical commerce row must resolve its parents.
    const orphanChecks: [string, string][] = [
      [
        "customers without organization",
        `select count(*)::int n from public.customers c
         where not exists (select 1 from public.organizations o where o.id = c.organization_id)`,
      ],
      [
        "subscriptions without customer",
        `select count(*)::int n from public.subscriptions s
         where not exists (select 1 from public.customers c where c.id = s.customer_id)`,
      ],
      [
        "order_items without order",
        `select count(*)::int n from public.order_items i
         where not exists (select 1 from public.orders o where o.id = i.order_id)`,
      ],
      [
        "deliveries without subscription",
        `select count(*)::int n from public.subscription_deliveries d
         where not exists (select 1 from public.subscriptions s where s.id = d.subscription_id)`,
      ],
    ];
    for (const [label, sql] of orphanChecks) {
      const r = await c.query(sql);
      if (r.rows[0].n > 0) report.orphans.push(`${label}: ${r.rows[0].n}`);
    }

    if (report.orphans.length > 0) {
      await c.query("rollback"); // all-or-nothing: never land a broken graph
      return report;
    }
    await c.query("commit");
    return report;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
