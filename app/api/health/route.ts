import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

// Aggregate health — the human/monitoring-facing endpoint. Returns the full
// dependency report; 200 when ready (critical deps up), 503 otherwise.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await runHealthChecks();
  return NextResponse.json(report, { status: report.ready ? 200 : 503 });
}
