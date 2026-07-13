import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

// Detailed status — always 200 so dashboards can scrape per-dependency latency
// and the degraded/down rollup without tripping their own alerting on a 503.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await runHealthChecks());
}
