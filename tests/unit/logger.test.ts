import { describe, expect, it } from "vitest";
import {
  logEvent,
  correlationId,
  correlationIdFrom,
  type LogSink,
} from "@/lib/logger";

function capture(): { sink: LogSink; lines: string[] } {
  const lines: string[] = [];
  return { sink: { write: (l) => lines.push(l) }, lines };
}

describe("structured logger", () => {
  it("emits one JSON object per line with level, message, fields, timestamp", () => {
    const { sink, lines } = capture();
    logEvent(
      "info",
      "pos.webhook.received",
      { correlationId: "abc", n: 3 },
      sink,
    );
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed).toMatchObject({
      level: "info",
      message: "pos.webhook.received",
      correlationId: "abc",
      n: 3,
    });
    expect(typeof parsed.at).toBe("string");
    expect(Number.isNaN(Date.parse(parsed.at))).toBe(false);
  });

  it("mints a correlation id and reads an inbound one", () => {
    const generated = correlationId();
    expect(generated).toMatch(/[0-9a-f-]{36}/);

    const withHeader = new Request("http://x/api", {
      headers: { "x-correlation-id": "trace-123" },
    });
    expect(correlationIdFrom(withHeader)).toBe("trace-123");
    // Absent header → a fresh id is minted (not empty).
    expect(
      correlationIdFrom(new Request("http://x/api")).length,
    ).toBeGreaterThan(0);
  });
});
