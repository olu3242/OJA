import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "../helpers";
import { withIdempotency } from "@/lib/idempotency";
import { withRetry, withTimeout, TimeoutError } from "@/lib/retry";
import { ingestSellThrough } from "@/server/services/pos";

const noSleep = () => Promise.resolve();

describe("withIdempotency", () => {
  beforeAll(async () => {
    await resetDb();
    await db.webhookEvent.deleteMany({});
  });

  it("runs the handler once and replays the stored result", async () => {
    let calls = 0;
    const run = () =>
      withIdempotency("test", "evt-1", async () => {
        calls++;
        return { ok: true, n: calls };
      });

    const first = await run();
    const second = await run();

    expect(first).toEqual({ replayed: false, result: { ok: true, n: 1 } });
    expect(second.replayed).toBe(true);
    expect(second.result).toEqual({ ok: true, n: 1 }); // stored, not re-run
    expect(calls).toBe(1); // handler executed exactly once
  });

  it("protects a POS webhook replay from double-emitting demand events", async () => {
    const fx = await resetDb();
    await db.webhookEvent.deleteMany({});
    const payload = {
      source: "manual" as const,
      storeAccountId: fx.household.id,
      eventId: "pos-evt-42",
      entries: [{ skuCode: "GAR-YEL", unitsSold: 5, periodEnd: "2026-07-01" }],
    };

    await withIdempotency("pos", payload.eventId, () =>
      ingestSellThrough(payload),
    );
    const replay = await withIdempotency("pos", payload.eventId, () =>
      ingestSellThrough(payload),
    );

    expect(replay.replayed).toBe(true);
    const events = await db.demandEvent.count({
      where: { type: "SELL_THROUGH" },
    });
    expect(events).toBe(1); // replay did NOT create a second event
  });

  it("re-runs after a failed attempt (does not poison the key)", async () => {
    let calls = 0;
    await expect(
      withIdempotency("test", "evt-flaky", async () => {
        calls++;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const recovered = await withIdempotency("test", "evt-flaky", async () => {
      calls++;
      return "ok";
    });
    expect(recovered).toEqual({ replayed: false, result: "ok" });
    expect(calls).toBe(2);
  });
});

describe("withRetry / withTimeout", () => {
  it("retries until success with backoff", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error("transient");
        return "done";
      },
      { retries: 3, sleep: noSleep },
    );
    expect(result).toBe("done");
    expect(attempts).toBe(3);
  });

  it("gives up after exhausting retries and rethrows", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("always fails");
        },
        { retries: 2, sleep: noSleep },
      ),
    ).rejects.toThrow("always fails");
    expect(attempts).toBe(3); // first try + 2 retries
  });

  it("honors shouldRetry (no retry on non-retryable errors)", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw new Error("fatal");
        },
        { retries: 5, sleep: noSleep, shouldRetry: () => false },
      ),
    ).rejects.toThrow("fatal");
    expect(attempts).toBe(1);
  });

  it("times out a hanging operation", async () => {
    await expect(
      withTimeout(new Promise((r) => setTimeout(r, 1000)), 20),
    ).rejects.toBeInstanceOf(TimeoutError);
  });
});
