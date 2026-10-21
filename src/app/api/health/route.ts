import { NextResponse } from "next/server";
import { configurationReport } from "@/lib/env";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Health and readiness.
 *
 * Reports whether the application is configured and whether the database
 * answers. It never returns a secret, a token or a configuration *value* —
 * only names and booleans.
 */
export async function GET() {
  const report = configurationReport();
  const session = await getSession();

  const databaseReachable = session.configured && !session.problem;

  // The endpoint is public, so the *reason* is only given to somebody who
  // is signed in. An anonymous caller gets the state, not the database's
  // error message.
  const isSignedIn = Boolean(session.userId);
  const problem = session.problem;

  const body = {
    status: report.ready && databaseReachable ? "ok" : "degraded",
    configuration: {
      ready: report.ready,
      present: report.present,
      missing: report.missing,
    },
    database: {
      reachable: databaseReachable,
      ...(problem && isSignedIn ? { problem } : {}),
    },
    version: process.env.npm_package_version ?? "0.1.0",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: body.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
