import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTodayInTimezone } from "@/domain/timezone";
import { resolveRangeFromParams } from "@/lib/range-params";
import { exportFilename, toCsv, type CsvColumn } from "@/lib/reports/csv";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  kind: z.enum(["ads", "ga4", "gsc", "social", "websites", "audit"]),
  from: z.string().optional(),
  to: z.string().optional(),
  safe: z.enum(["0", "1"]).default("1"),
});

/**
 * Export a report as CSV.
 *
 * The export contains the same reviewed values as the screen, plus the
 * freshness and source caveats in a header comment. "Share safe" mode masks
 * customer, mailbox and sensitive account identifiers.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!session.permissions.has("reports.export")) {
    return NextResponse.json(
      { error: "You do not have permission to export reports" },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    kind: url.searchParams.get("kind") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    safe: url.searchParams.get("safe") ?? undefined,
  });
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
  );

  const db = await createClient();
  const workspaceId = session.workspaceId;
  const safeMode = parsed.data.safe === "1";

  const { columns, rows, source } = await buildExport(
    db,
    workspaceId,
    parsed.data.kind,
    range.current.start,
    range.current.end,
  );

  const caveats = [
    `# CCM ${parsed.data.kind} export`,
    `# Period: ${range.current.start} to ${range.current.end}`,
    `# Timezone: ${session.workspaceTimezone}`,
    `# Currency: ${session.workspaceCurrency}`,
    `# Source: ${source}`,
    `# Generated: ${new Date().toISOString()}`,
    safeMode
      ? "# Share safe mode: customer, mailbox and sensitive identifiers are masked."
      : "# Share safe mode is OFF: identifiers are present in full.",
    "# Missing values are blank. A blank is not a zero.",
  ].join("\n");

  const csv = `${caveats}\r\n${toCsv(columns, rows, { safeMode })}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(
        parsed.data.kind,
        range.current.start,
        range.current.end,
      )}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Build the columns and rows for one export kind.
 */
async function buildExport(
  db: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  kind: string,
  start: string,
  end: string,
): Promise<{
  columns: CsvColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
  source: string;
}> {
  switch (kind) {
    case "ads": {
      const { data } = await db
        .from("daily_ads_metrics")
        .select(
          "metric_date, dimension, dimension_label, impressions, clicks, cost_micros, conversions, conversion_value_micros, currency, source_fetched_at",
        )
        .eq("workspace_id", workspaceId)
        .gte("metric_date", start)
        .lte("metric_date", end)
        .order("metric_date", { ascending: true });

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return {
        source: "Google Ads",
        rows,
        columns: [
          { key: "date", header: "Date", value: (row) => row.metric_date },
          {
            key: "dimension",
            header: "Dimension",
            value: (row) => row.dimension,
          },
          {
            key: "label",
            header: "Name",
            value: (row) => row.dimension_label,
          },
          {
            key: "impressions",
            header: "Impressions",
            value: (row) => row.impressions,
          },
          { key: "clicks", header: "Clicks", value: (row) => row.clicks },
          {
            key: "cost_micros",
            header: "Cost (micros)",
            value: (row) => row.cost_micros,
          },
          {
            key: "conversions",
            header: "Conversions",
            value: (row) => row.conversions,
          },
          {
            key: "value_micros",
            header: "Conversion value (micros)",
            value: (row) => row.conversion_value_micros,
          },
          { key: "currency", header: "Currency", value: (row) => row.currency },
          {
            key: "fetched",
            header: "Source fetched at",
            value: (row) => row.source_fetched_at,
          },
        ],
      };
    }

    case "ga4": {
      const { data } = await db
        .from("daily_ga4_metrics")
        .select(
          "metric_date, dimension, dimension_label, sessions, active_users, new_users, engaged_sessions, key_events, event_name, revenue, currency, source_fetched_at",
        )
        .eq("workspace_id", workspaceId)
        .gte("metric_date", start)
        .lte("metric_date", end)
        .order("metric_date", { ascending: true });

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return {
        source: "Google Analytics 4",
        rows,
        columns: [
          { key: "date", header: "Date", value: (row) => row.metric_date },
          { key: "dimension", header: "Dimension", value: (row) => row.dimension },
          { key: "label", header: "Name", value: (row) => row.dimension_label },
          { key: "sessions", header: "Sessions", value: (row) => row.sessions },
          {
            key: "active_users",
            header: "Active users",
            value: (row) => row.active_users,
          },
          {
            key: "engaged_sessions",
            header: "Engaged sessions",
            value: (row) => row.engaged_sessions,
          },
          {
            key: "key_events",
            header: "Key events",
            value: (row) => row.key_events,
          },
          { key: "event", header: "Event", value: (row) => row.event_name },
          { key: "revenue", header: "Revenue", value: (row) => row.revenue },
          { key: "currency", header: "Currency", value: (row) => row.currency },
          {
            key: "fetched",
            header: "Source fetched at",
            value: (row) => row.source_fetched_at,
          },
        ],
      };
    }

    case "gsc": {
      const { data } = await db
        .from("daily_gsc_metrics")
        .select(
          "metric_date, dimension, dimension_label, clicks, impressions, ctr, position, country, device, search_type, source_fetched_at",
        )
        .eq("workspace_id", workspaceId)
        .gte("metric_date", start)
        .lte("metric_date", end)
        .order("metric_date", { ascending: true });

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return {
        source: "Google Search Console",
        rows,
        columns: [
          { key: "date", header: "Date", value: (row) => row.metric_date },
          { key: "dimension", header: "Dimension", value: (row) => row.dimension },
          { key: "label", header: "Query / page", value: (row) => row.dimension_label },
          { key: "clicks", header: "Clicks", value: (row) => row.clicks },
          {
            key: "impressions",
            header: "Impressions",
            value: (row) => row.impressions,
          },
          { key: "ctr", header: "CTR", value: (row) => row.ctr },
          { key: "position", header: "Position", value: (row) => row.position },
          { key: "country", header: "Country", value: (row) => row.country },
          { key: "device", header: "Device", value: (row) => row.device },
          { key: "search_type", header: "Search type", value: (row) => row.search_type },
          {
            key: "fetched",
            header: "Source fetched at",
            value: (row) => row.source_fetched_at,
          },
        ],
      };
    }

    case "social": {
      const { data } = await db
        .from("social_account_metrics")
        .select(
          "metric_date, organic, followers, reach, impressions, engagements, clicks, video_views, content_count, source_fetched_at",
        )
        .eq("workspace_id", workspaceId)
        .gte("metric_date", start)
        .lte("metric_date", end)
        .order("metric_date", { ascending: true });

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return {
        source: "Social platforms",
        rows,
        columns: [
          { key: "date", header: "Date", value: (row) => row.metric_date },
          {
            key: "organic",
            header: "Organic",
            value: (row) => (row.organic ? "yes" : "no"),
          },
          {
            key: "followers",
            header: "Followers",
            value: (row) => row.followers,
          },
          { key: "reach", header: "Reach", value: (row) => row.reach },
          {
            key: "impressions",
            header: "Impressions",
            value: (row) => row.impressions,
          },
          {
            key: "engagements",
            header: "Engagements",
            value: (row) => row.engagements,
          },
          { key: "clicks", header: "Clicks", value: (row) => row.clicks },
          {
            key: "video_views",
            header: "Video views",
            value: (row) => row.video_views,
          },
          {
            key: "fetched",
            header: "Source fetched at",
            value: (row) => row.source_fetched_at,
          },
        ],
      };
    }

    case "websites": {
      const { data } = await db
        .from("websites")
        .select(
          "name, domain, primary_locale, locales, service_lines, owner_label, health_state, is_active, created_at",
        )
        .eq("workspace_id", workspaceId)
        .order("name", { ascending: true });

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return {
        source: "Website registry",
        rows,
        columns: [
          { key: "name", header: "Site", value: (row) => row.name },
          { key: "domain", header: "Domain", value: (row) => row.domain },
          {
            key: "locale",
            header: "Primary locale",
            value: (row) => row.primary_locale,
          },
          {
            key: "locales",
            header: "Locales",
            value: (row) => (row.locales as string[] | null)?.join(" "),
          },
          {
            key: "services",
            header: "Service lines",
            value: (row) => (row.service_lines as string[] | null)?.join(" "),
          },
          {
            key: "owner",
            header: "Owner",
            value: (row) => row.owner_label,
            sensitive: true,
          },
          {
            key: "health",
            header: "Health",
            value: (row) => row.health_state,
          },
        ],
      };
    }

    case "audit":
    default: {
      const { data } = await db
        .from("audit_events")
        .select(
          "created_at, actor_user_id, action, entity_type, entity_id, target_label, severity, details",
        )
        .eq("workspace_id", workspaceId)
        .gte("created_at", `${start}T00:00:00.000Z`)
        .lte("created_at", `${end}T23:59:59.999Z`)
        .order("created_at", { ascending: false });

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return {
        source: "CCM audit log",
        rows,
        columns: [
          { key: "created", header: "When", value: (row) => row.created_at },
          { key: "action", header: "Action", value: (row) => row.action },
          {
            key: "entity",
            header: "Entity",
            value: (row) => row.entity_type,
          },
          {
            key: "target",
            header: "Target",
            value: (row) => row.target_label,
            sensitive: true,
          },
          {
            key: "actor",
            header: "Actor",
            value: (row) => row.actor_user_id,
            sensitive: true,
          },
          {
            key: "severity",
            header: "Severity",
            value: (row) => row.severity,
          },
        ],
      };
    }
  }
}
