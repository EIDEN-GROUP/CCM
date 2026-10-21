import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { writeAuditEvent } from "@/lib/repositories/alerts";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().min(2).max(160),
  /** The registrable domain, e.g. "medicalbay.ma". */
  domain: z
    .string()
    .min(3)
    .max(190)
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
      "That is not a valid domain",
    ),
  /** Extra hostnames that answer for the same site. */
  hostnames: z.array(z.string().min(3).max(190)).max(20).default([]),
  primaryLocale: z.string().min(2).max(10).default("fr"),
  locales: z.array(z.string().min(2).max(10)).max(20).default([]),
  serviceLines: z.array(z.string().min(2).max(60)).max(30).default([]),
  ownerLabel: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

/**
 * Register a website.
 *
 * The registry is generic: a future Medical Bay microsite appears by
 * adding a row, with no code or schema change. Only the domain and the
 * provider identifiers are stored — never a page snapshot of the site.
 */
/** An empty string is "not set", not an empty value. */
function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("integrations.manage")) {
    return NextResponse.json(
      { error: "You do not have permission to register websites" },
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

  const supabase = await createClient();
  const workspaceId = session.workspaceId;

  const domain = parsed.data.domain.trim().toLowerCase();
  const locales =
    parsed.data.locales.length > 0 ? parsed.data.locales : ["fr", "en", "ar"];

  const { data: website, error } = await supabase
    .from("websites")
    .upsert(
      {
        workspace_id: workspaceId,
        name: parsed.data.name.trim(),
        domain,
        primary_locale: parsed.data.primaryLocale,
        locales,
        service_lines: parsed.data.serviceLines,
        // An empty field is "not set", not an empty label.
        owner_label: blank(parsed.data.ownerLabel),
        notes: blank(parsed.data.notes),
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,domain" },
    )
    .select("id, name, domain")
    .single();

  if (error || !website) {
    return NextResponse.json(
      {
        error:
          error?.message ??
          "The website could not be registered. The domain may already be registered.",
      },
      { status: 400 },
    );
  }

  // The primary hostname, plus any extra ones the owner listed.
  const hostnames = [
    domain,
    ...parsed.data.hostnames
      .map((hostname) => hostname.trim().toLowerCase())
      .filter((hostname) => hostname.length > 0 && hostname !== domain),
  ];

  for (const [index, hostname] of hostnames.entries()) {
    const { error: hostnameError } = await supabase
      .from("website_domains")
      .upsert(
        {
          website_id: website.id,
          hostname,
          is_primary: index === 0,
        },
        { onConflict: "hostname" },
      );

    if (hostnameError) {
      console.error(
        `could not register the hostname ${hostname}`,
        hostnameError.message,
      );
    }
  }

  await writeAuditEvent(supabase, {
    workspaceId,
    actorUserId: session.userId,
    action: "website.registered",
    entityType: "website",
    entityId: website.id,
    targetLabel: website.name,
    details: { domain, hostnames },
  });

  return NextResponse.json({ ok: true, website });
}
