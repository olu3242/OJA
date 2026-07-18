import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyStripeEvent, StripeSignatureError } from "@/lib/stripe";
import { withIdempotency } from "@/lib/idempotency";
import { captureError } from "@/lib/observability";
import { canonicalPool } from "@/lib/canonical-db";
import { rateLimit, clientKey, rateLimitHeaders } from "@/lib/rate-limit";
import { logger, correlationIdFrom } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-IP flood protection ahead of signature verification.
const RATE = { limit: 300, windowMs: 60_000 };

/**
 * Stripe webhook (WS10 Phase 2/10). The signature is verified against the raw
 * body before anything else; an invalid/tampered payload is rejected 400. The
 * event is then processed under `withIdempotency("stripe", event.id, …)` so a
 * redelivery never applies twice, and each event is mirrored into the
 * append-only `payment_events` ledger keyed on the Stripe event id (a second
 * DB-level idempotency layer via the unique `provider_event_id`).
 */
async function applyStripeEvent(
  event: Stripe.Event,
): Promise<{ handled: boolean }> {
  const obj = event.data.object as { id?: string; payment_intent?: string };
  const providerRef =
    (event.type.startsWith("charge.refund") && obj.payment_intent) || obj.id;

  const payment = await canonicalPool.query(
    `select id, organization_id from public.payments where provider_ref = $1`,
    [providerRef],
  );
  if (payment.rowCount === 0) return { handled: false };
  const { id: paymentId, organization_id: orgId } = payment.rows[0];

  await canonicalPool.query(
    `insert into public.payment_events
       (organization_id, payment_id, provider, event_type, provider_event_id, payload)
     values ($1,$2,'stripe',$3,$4,$5)
     on conflict (provider_event_id) do nothing`,
    [orgId, paymentId, event.type, event.id, JSON.stringify(event.data.object)],
  );

  if (event.type === "payment_intent.payment_failed") {
    await canonicalPool.query(
      `update public.payments set status = 'failed' where id = $1 and status = 'pending'`,
      [paymentId],
    );
  } else if (event.type === "payment_intent.succeeded") {
    await canonicalPool.query(
      `update public.payments set status = 'captured' where id = $1 and status = 'pending'`,
      [paymentId],
    );
  }
  return { handled: true };
}

export async function POST(req: Request) {
  const limit = rateLimit(`stripe:${clientKey(req)}`, RATE);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate limited" },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }
  const correlationId = correlationIdFrom(req);
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = verifyStripeEvent(rawBody, signature);
  } catch (e) {
    if (e instanceof StripeSignatureError) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
    captureError(e, { route: "webhooks/stripe", correlationId });
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }

  logger.info("stripe.webhook.received", {
    correlationId,
    eventId: event.id,
    type: event.type,
  });
  try {
    const { replayed, result } = await withIdempotency("stripe", event.id, () =>
      applyStripeEvent(event),
    );
    return NextResponse.json(
      { received: true, replayed, ...result },
      { headers: { "x-correlation-id": correlationId } },
    );
  } catch (e) {
    logger.error("stripe.webhook.failed", { correlationId, eventId: event.id });
    captureError(e, {
      route: "webhooks/stripe",
      eventId: event.id,
      correlationId,
    });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
