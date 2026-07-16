import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  recordDeadLetter,
  processWithDlq,
  replayDeadLetter,
  deadLetterCount,
  listDeadLetters,
  discardDeadLetter,
} from "@/lib/dlq";

const noSleep = () => Promise.resolve();

describe("dead-letter queue", () => {
  beforeEach(async () => {
    await db.deadLetter.deleteMany({});
  });

  it("records a dead letter with payload, error, and attempts", async () => {
    const { id } = await recordDeadLetter({
      source: "pos",
      eventKey: "evt-1",
      payload: { a: 1 },
      error: new Error("boom"),
      attempts: 3,
    });
    const dl = await db.deadLetter.findUniqueOrThrow({ where: { id } });
    expect(dl).toMatchObject({
      source: "pos",
      eventKey: "evt-1",
      error: "boom",
      attempts: 3,
      status: "PENDING",
    });
    expect(dl.payload).toEqual({ a: 1 });
  });

  it("processWithDlq retries then dead-letters on permanent failure", async () => {
    let calls = 0;
    await expect(
      processWithDlq(
        { source: "event", eventKey: "e-2", payload: { x: 9 } },
        async () => {
          calls += 1;
          throw new Error("always fails");
        },
        { retries: 2, sleep: noSleep },
      ),
    ).rejects.toThrow("always fails");
    expect(calls).toBe(3); // 1 + 2 retries

    const rows = await listDeadLetters("PENDING");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: "event", attempts: 3 });
  });

  it("processWithDlq records nothing when the handler eventually succeeds", async () => {
    let calls = 0;
    const result = await processWithDlq(
      { source: "event", eventKey: "e-ok", payload: {} },
      async () => {
        calls += 1;
        if (calls < 2) throw new Error("transient");
        return "done";
      },
      { retries: 3, sleep: noSleep },
    );
    expect(result).toBe("done");
    expect(await deadLetterCount()).toBe(0);
  });

  it("replays a dead letter: success marks REPLAYED, no longer pending", async () => {
    const { id } = await recordDeadLetter({
      source: "pos",
      eventKey: "evt-replay",
      payload: { units: 5 },
      error: "boom",
    });
    let seen: unknown = null;
    const res = await replayDeadLetter(id, async (payload) => {
      seen = payload;
      return "ok";
    });
    expect(res.status).toBe("REPLAYED");
    expect(seen).toEqual({ units: 5 });
    expect(await deadLetterCount("PENDING")).toBe(0);
    expect(await deadLetterCount("REPLAYED")).toBe(1);
  });

  it("replay failure keeps it PENDING and bumps attempts", async () => {
    const { id } = await recordDeadLetter({
      source: "pos",
      eventKey: "evt-fail",
      payload: {},
      error: "boom",
    });
    await expect(
      replayDeadLetter(id, async () => {
        throw new Error("still broken");
      }),
    ).rejects.toThrow("still broken");
    const dl = await db.deadLetter.findUniqueOrThrow({ where: { id } });
    expect(dl.status).toBe("PENDING");
    expect(dl.attempts).toBe(2);
    expect(dl.error).toBe("still broken");
  });

  it("discards a dead letter so it is no longer pending", async () => {
    const { id } = await recordDeadLetter({
      source: "pos",
      eventKey: "evt-discard",
      payload: {},
      error: "boom",
    });
    await discardDeadLetter(id);
    expect(await deadLetterCount("PENDING")).toBe(0);
    expect(await deadLetterCount("DISCARDED")).toBe(1);
  });
});
