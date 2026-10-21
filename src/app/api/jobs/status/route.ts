import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Queue health.
 *
 * Reports the queue depth, the oldest running job and the dead-letter
 * count. Used by the container health check and by operations.
 */
export async function GET(request: Request) {
  const secret = serverEnv.cronSecret();
  const authorization = request.headers.get("authorization") ?? "";

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const supabase = createAdminClient();

  try {
    const { data: queued } = await supabase
      .from("sync_jobs")
      .select("id, run_after, attempts", { count: "exact" })
      .eq("status", "queued");

    const { data: running } = await supabase
      .from("sync_jobs")
      .select("id, locked_until, lease_owner", { count: "exact" })
      .eq("status", "running");

    const { count: deadLetter } = await supabase
      .from("sync_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "dead_letter");

    const oldestQueued = (queued ?? []).reduce<string | null>(
      (oldest, job) => {
        if (!oldest || job.run_after < oldest) return job.run_after;
        return oldest;
      },
      null,
    );

    return NextResponse.json(
      {
        queued: queued?.length ?? 0,
        running: running?.length ?? 0,
        deadLetter: deadLetter ?? 0,
        oldestQueuedAt: oldestQueued,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    // The queue could not be read. That is a real operational state, and it
    // is reported as one rather than as an empty queue.
    console.error(
      "could not read the queue",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      {
        error: "The queue could not be read.",
        queued: null,
        running: null,
        deadLetter: null,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
