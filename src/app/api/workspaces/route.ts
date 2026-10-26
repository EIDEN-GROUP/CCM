import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

function setActiveWorkspaceCookie(id: string) {
  return cookies().then((store) => {
    store.set("ccm_active_workspace", id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  });
}

/** Create a workspace for an existing workspace owner. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.canCreateWorkspace) {
    return NextResponse.json({ error: "Only a workspace owner can create workspaces" }, { status: 403 });
  }

  const parsed = workspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a workspace name between 2 and 80 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace_for_owner", {
    p_name: parsed.data.name,
  });
  const workspace = data?.[0];
  if (error || !workspace) {
    console.error("Workspace creation failed", error?.message);
    return NextResponse.json({ error: "The workspace could not be created. Please try again." }, { status: 400 });
  }

  await writeAuditEvent(supabase, {
    workspaceId: workspace.id,
    actorUserId: session.userId,
    action: "workspace.created",
    entityType: "workspace",
    entityId: workspace.id,
    targetLabel: workspace.name,
  });
  await setActiveWorkspaceCookie(workspace.id);
  return NextResponse.json({ ok: true, workspace });
}

/** Rename the active workspace. Only its owner may do this. */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.role !== "owner") {
    return NextResponse.json({ error: "Only this workspace's owner can rename it" }, { status: 403 });
  }

  const parsed = workspaceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a workspace name between 2 and 80 characters." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name: parsed.data.name })
    .eq("id", session.workspaceId)
    .select("id,name")
    .single();
  if (error || !data) {
    console.error("Workspace rename failed", error?.message);
    return NextResponse.json({ error: "The workspace name could not be changed." }, { status: 400 });
  }

  await writeAuditEvent(supabase, {
    workspaceId: session.workspaceId,
    actorUserId: session.userId,
    action: "workspace.renamed",
    entityType: "workspace",
    entityId: session.workspaceId,
    targetLabel: data.name,
  });

  return NextResponse.json({ ok: true, workspace: data });
}
