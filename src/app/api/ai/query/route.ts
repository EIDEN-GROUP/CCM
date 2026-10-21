import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTodayInTimezone } from "@/domain/timezone";
import { resolveRangeFromParams } from "@/lib/range-params";
import { askAnalyst, buildGroundContext } from "@/lib/ai/analyst";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  question: z.string().min(3).max(2000),
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * Ask the grounded analyst.
 *
 * The answer and the list of records behind it are stored, so the trail is
 * inspectable later. The question is never sent with mailbox content or
 * credentials — only the aggregate facts.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("ai.query")) {
    return NextResponse.json(
      { error: "You do not have permission to use the analyst" },
      { status: 403 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const today = getTodayInTimezone(session.workspaceTimezone);
  const range = resolveRangeFromParams(
    { from: parsed.data.from, to: parsed.data.to, range: "28d" },
    today,
  ).current;

  const db = await createClient();
  const context = await buildGroundContext(db, session.workspaceId, range);
  const result = await askAnalyst(parsed.data.question, context, range);

  // Persist the request and its sources so the trail is inspectable.
  const { data: requestRow } = await db
    .from("ai_insight_requests")
    .insert({
      workspace_id: session.workspaceId,
      user_id: session.userId,
      question: parsed.data.question,
      answer: result.answer,
      status: result.grounded ? "answered" : "refused",
      model: result.model,
      filters: { from: range.start, to: range.end },
      caveats: result.caveats,
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (requestRow) {
    for (const source of result.sources) {
      await db.from("ai_insight_sources").insert({
        request_id: requestRow.id,
        source_type: source.sourceType,
        source_ref: source.sourceRef,
        label: source.label,
        period_start: source.periodStart,
        period_end: source.periodEnd,
        fetched_at: source.fetchedAt,
        excerpt: source.excerpt,
      });
    }
  }

  return NextResponse.json({
    answer: result.answer,
    grounded: result.grounded,
    model: result.model,
    sources: result.sources,
    caveats: result.caveats,
    period: range,
  });
}
