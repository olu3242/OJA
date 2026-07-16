import Stripe from "stripe";

/**
 * Stripe client + webhook signature verification (WS10 Phase 2/10). The API
 * client is only constructed when `STRIPE_SECRET_KEY` is present (live card
 * charging); signature verification needs only `STRIPE_WEBHOOK_SECRET` and works
 * offline — it is HMAC over the raw body, so no network or real API key is
 * required. This lets us verify webhook authenticity (and unit-test it) without
 * live Stripe credentials.
 */
const API_VERSION = "2026-06-24.dahlia";

let apiClient: Stripe | null = null;
let verifier: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Live API client — null when no secret key is configured. */
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!apiClient) apiClient = new Stripe(key, { apiVersion: API_VERSION });
  return apiClient;
}

// A key-less instance is enough for HMAC verification; the placeholder key is
// never used for crypto (only the webhook signing secret is).
function verificationClient(): Stripe {
  if (!verifier) {
    verifier = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_verify_only", {
      apiVersion: API_VERSION,
    });
  }
  return verifier;
}

export class StripeSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeSignatureError";
  }
}

/**
 * Verify a Stripe webhook signature and return the parsed event. Throws
 * `StripeSignatureError` on a missing secret, missing/invalid signature, or a
 * tampered body — the caller must reject the request (401/400) in that case.
 */
export function verifyStripeEvent(
  rawBody: string,
  signature: string | null,
  secret = process.env.STRIPE_WEBHOOK_SECRET,
): Stripe.Event {
  if (!secret) throw new StripeSignatureError("STRIPE_WEBHOOK_SECRET not set");
  if (!signature) throw new StripeSignatureError("missing stripe-signature");
  try {
    return verificationClient().webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    );
  } catch (e) {
    throw new StripeSignatureError(
      e instanceof Error ? e.message : "invalid signature",
    );
  }
}
