import { NextResponse } from "next/server";
import { runHealthChecks } from "@/lib/health";

// Readiness probe — 200 only when every critical dependency is reachable, else
// 503 so the load balancer stops routing traffic to this instance.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const report = await runHealthChecks();
  return NextResponse.json(report, { status: report.ready ? 200 : 503 });
}
