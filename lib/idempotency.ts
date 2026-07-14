import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Webhook/command idempotency (WS9). `withIdempotency` records one row per
 * (source, eventKey); a replayed delivery finds the existing PROCESSED row and
 * returns its stored result WITHOUT re-running the handler. This protects
 * against duplicate provider deliveries (POS today, Stripe when it lands) that
 * would otherwise double-emit demand events or double-charge.
 *
 * Concurrency is handled by the `@@unique([source, eventKey])` constraint:
 * two simultaneous deliveries race to insert; the loser catches the unique
 * violation and waits for / reads the winner's result.
 */
export type IdempotencyOutcome<T> = {
  replayed: boolean;
  result: T;
};

const UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === UNIQUE_VIOLATION
  );
}

export async function withIdempotency<T>(
  source: string,
  eventKey: string,
  handler: () => Promise<T>,
): Promise<IdempotencyOutcome<T>> {
  // Fast path: already processed.
  const existing = await db.webhookEvent.findUnique({
    where: { source_eventKey: { source, eventKey } },
  });
  if (existing?.status === "PROCESSED") {
    return { replayed: true, result: existing.result as T };
  }

  // Claim the key. If a concurrent delivery already claimed it, treat as replay.
  if (!existing) {
    try {
      await db.webhookEvent.create({
        data: { source, eventKey, status: "PENDING" },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        const winner = await db.webhookEvent.findUnique({
          where: { source_eventKey: { source, eventKey } },
        });
        return { replayed: true, result: winner?.result as T };
      }
      throw e;
    }
  }

  // We own the key (or a prior attempt left it PENDING/FAILED) — run the handler.
  try {
    const result = await handler();
    await db.webhookEvent.update({
      where: { source_eventKey: { source, eventKey } },
      data: {
        status: "PROCESSED",
        result: (result ?? null) as Prisma.InputJsonValue,
      },
    });
    return { replayed: false, result };
  } catch (e) {
    await db.webhookEvent
      .update({
        where: { source_eventKey: { source, eventKey } },
        data: { status: "FAILED" },
      })
      .catch(() => {});
    throw e;
  }
}
