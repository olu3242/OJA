import { NextResponse } from "next/server";

// Liveness probe — proves the process is up and serving. Dependency-free by
// design so an orchestrator never restarts a healthy pod over a slow DB.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export function GET() {
  return NextResponse.json({
    status: "live",
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
}
