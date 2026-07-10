import { NextResponse } from "next/server";
import {
  ingestSellThrough,
  type SellThroughPayload,
} from "@/server/services/pos";
import { captureError } from "@/lib/observability";

// POS sell-through webhook (task 4.2). Square/Clover adapters normalize into
// this shape; a shared secret gates ingestion until per-provider signature
// verification lands with the real integrations.
export async function POST(req: Request) {
  const secret = process.env.POS_WEBHOOK_SECRET ?? "dev-pos-secret";
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const payload = (await req.json()) as SellThroughPayload;
    if (!payload?.storeAccountId || !Array.isArray(payload.entries)) {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    const results = await ingestSellThrough(payload);
    return NextResponse.json({ results });
  } catch (error) {
    captureError(error, { route: "webhooks/pos" });
    return NextResponse.json({ error: "ingest failed" }, { status: 500 });
  }
}
