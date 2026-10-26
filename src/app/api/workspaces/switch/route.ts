import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const switchSchema = z.object({ workspaceId: z.string().uuid() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const parsed = switchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a valid workspace." }, { status: 400 });
  }

  // RLS plus this membership check makes a client supplied workspace id only
  // a preference; it can never grant access to a different tenant.
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", parsed.data.workspaceId)
    .eq("user_id", session.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: "You do not belong to that workspace." }, { status: 403 });
  }

  const store = await cookies();
  store.set("ccm_active_workspace", parsed.data.workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return NextResponse.json({ ok: true });
}
