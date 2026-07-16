import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ingestSellThrough,
  type SellThroughPayload,
} from "@/server/services/pos";
import { captureError } from "@/lib/observability";
import { withIdempotency } from "@/lib/idempotency";
import { recordDeadLetter } from "@/lib/dlq";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Per-IP flood protection on the unauthenticated ingress surface.
const RATE = { limit: 120, windowMs: 60_000 };

// POS sell-through webhook (task 4.2). Square/Clover adapters normalize into
// this shape; a shared secret gates ingestion until per-provider signature
// verification lands with the real integrations. Deliveries are idempotent:
// a replay (same eventId, or same payload when no eventId) returns the original
// result WITHOUT re-emitting demand events.
function idempotencyKey(payload: SellThroughPayload): string {
  if (payload.eventId) return payload.eventId;
  // Deterministic fallback so an accidental redelivery of the same body dedupes.
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 32);
}

export async function POST(req: Request) {
  const limit = rateLimit(`pos:${clientKey(req)}`, RATE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }
  const secret = process.env.POS_WEBHOOK_SECRET ?? "dev-pos-secret";
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let payload: SellThroughPayload;
  try {
    payload = (await req.json()) as SellThroughPayload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!payload?.storeAccountId || !Array.isArray(payload.entries)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  try {
    const { replayed, result } = await withIdempotency(
      "pos",
      idempotencyKey(payload),
      () => ingestSellThrough(payload),
    );
    return NextResponse.json({ results: result, replayed });
  } catch (error) {
    // Never lose the event: dead-letter it for inspection + replay.
    captureError(error, { route: "webhooks/pos" });
    await recordDeadLetter({
      source: "pos",
      eventKey: idempotencyKey(payload),
      payload,
      error,
    }).catch(() => {});
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }
}
