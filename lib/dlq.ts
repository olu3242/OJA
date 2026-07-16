import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { captureError } from "@/lib/observability";
import { withRetry, type RetryOptions } from "@/lib/retry";

/**
 * Dead-letter queue (WS9). When an event/webhook handler fails permanently
 * (after its retries are exhausted), `processWithDlq` records the payload +
 * error here instead of losing it, then rethrows so the caller can still return
 * a 5xx. Operators inspect via `listDeadLetters` and re-run with `replayDeadLetter`.
 */
export type DeadLetterStatus = "PENDING" | "REPLAYED" | "DISCARDED";

export async function recordDeadLetter(input: {
  source: string;
  eventKey: string;
  payload: unknown;
  error: unknown;
  attempts?: number;
}): Promise<{ id: string }> {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);
  const row = await db.deadLetter.create({
    data: {
      source: input.source,
      eventKey: input.eventKey,
      payload: (input.payload ?? null) as Prisma.InputJsonValue,
      error: message.slice(0, 2000),
      attempts: input.attempts ?? 1,
    },
    select: { id: true },
  });
  return { id: row.id };
}

/**
 * Run a handler with bounded retries; on final failure, dead-letter the payload
 * and rethrow. On success the handler's result is returned untouched.
 */
export async function processWithDlq<T>(
  input: { source: string; eventKey: string; payload: unknown },
  handler: () => Promise<T>,
  retry: RetryOptions = {},
): Promise<T> {
  let attempts = 0;
  try {
    return await withRetry(async () => {
      attempts += 1;
      return handler();
    }, retry);
  } catch (error) {
    await recordDeadLetter({ ...input, error, attempts }).catch((e) =>
      captureError(e, { dlq: "record-failed", source: input.source }),
    );
    throw error;
  }
}

export async function listDeadLetters(
  status: DeadLetterStatus = "PENDING",
  limit = 50,
) {
  return db.deadLetter.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function deadLetterCount(
  status: DeadLetterStatus = "PENDING",
): Promise<number> {
  return db.deadLetter.count({ where: { status } });
}

/**
 * Re-run a dead letter through a handler. On success it is marked REPLAYED; on
 * failure the attempt count is incremented and it stays PENDING for another try.
 */
export async function replayDeadLetter<T>(
  id: string,
  handler: (payload: unknown) => Promise<T>,
): Promise<{ status: DeadLetterStatus; result?: T }> {
  const dl = await db.deadLetter.findUniqueOrThrow({ where: { id } });
  if (dl.status !== "PENDING") return { status: dl.status as DeadLetterStatus };
  try {
    const result = await handler(dl.payload);
    await db.deadLetter.update({
      where: { id },
      data: { status: "REPLAYED", attempts: { increment: 1 } },
    });
    return { status: "REPLAYED", result };
  } catch (error) {
    await db.deadLetter.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        error: (error instanceof Error ? error.message : String(error)).slice(
          0,
          2000,
        ),
      },
    });
    throw error;
  }
}

/** Mark a dead letter as intentionally discarded (won't be replayed). */
export async function discardDeadLetter(id: string): Promise<void> {
  await db.deadLetter.update({
    where: { id },
    data: { status: "DISCARDED" },
  });
}
