import type { JobHandler } from "@/lib/jobs/runner";
import { toConnectorAccount, windowFor } from "./google";
import { AhrefsConnector } from "@/providers/ahrefs/ahrefs";
import { MetaConnector } from "@/providers/meta/meta";
import { LinkedInConnector } from "@/providers/linkedin/linkedin";
import {
  upsertRankSnapshots,
  upsertSocialAccountMetrics,
  upsertSocialPostMetrics,
} from "@/lib/providers/upsert";

/**
 * The non-Google job handlers: rank tracking and social analytics.
 */

export const rankSnapshotHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);
  const connector = new AhrefsConnector();

  const device =
    (context.job.payload as { device?: "desktop" | "mobile" }).device ??
    "desktop";

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "rank", device },
    { accessToken: context.accessToken },
  );

  const rows = result.facts.map((fact) => {
    const values = fact.values;
    return {
      workspaceId: context.job.workspace_id,
      accountId: context.account.id,
      keyword: String(values.keyword ?? fact.dimensionLabel ?? ""),
      searchEngine: "google",
      country: (values.country as string | null) ?? null,
      city: (values.location as string | null) ?? null,
      device: String(values.device ?? device),
      landingUrl: (values.url as string | null) ?? null,
      position: typeof values.position === "number" ? values.position : null,
      observedOn: endDate,
      sourceProvider: "ahrefs",
    };
  });

  const rowsWritten = await upsertRankSnapshots(context.db, rows);
  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};

export const socialSnapshotHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);

  const surface =
    (context.job.payload as { surface?: "page" | "instagram" | "linkedin" })
      ?.surface ?? "page";

  const connector =
    surface === "linkedin"
      ? new LinkedInConnector()
      : new MetaConnector({ surface: surface === "instagram" ? "instagram" : "page" });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "social" },
    { accessToken: context.accessToken },
  );

  // The provider returns one fact per metric per day. Group them back into a
  // daily account row.
  const byDay = new Map<
    string,
    {
      impressions: number | null;
      reach: number | null;
      engagements: number | null;
      followers: number | null;
    }
  >();

  for (const fact of result.facts) {
    const entry = byDay.get(fact.metricDate) ?? {
      impressions: null,
      reach: null,
      engagements: null,
      followers: null,
    };
    const metric = String(fact.values.metric ?? "");
    const value = typeof fact.values.value === "number" ? fact.values.value : null;

    if (metric.includes("impression")) entry.impressions = value;
    else if (metric === "reach") entry.reach = value;
    else if (metric.includes("engagement") || metric.includes("interaction"))
      entry.engagements = value;
    else if (metric.includes("follower")) entry.followers = value;

    byDay.set(fact.metricDate, entry);
  }

  const rows = [...byDay.entries()].map(([metricDate, entry]) => ({
    workspaceId: context.job.workspace_id,
    accountId: context.account.id,
    metricDate,
    // Organic profile analytics. Paid social results are a separate series.
    organic: true,
    followers: entry.followers,
    reach: entry.reach,
    impressions: entry.impressions,
    engagements: entry.engagements,
    clicks: null,
    videoViews: null,
    contentCount: null,
    sourceFetchedAt: new Date().toISOString(),
  }));

  const rowsWritten = await upsertSocialAccountMetrics(context.db, rows);
  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};

export const socialPostsHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job);
  const connector = new MetaConnector({ surface: "instagram" });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "social" },
    { accessToken: context.accessToken },
  );

  // Post-level metrics come from the media endpoint, which is read
  // separately so the daily insights stay small.
  const rows = result.facts
    .filter((fact) => fact.values.post_id)
    .map((fact) => ({
      workspaceId: context.job.workspace_id,
      accountId: context.account.id,
      platform: context.connection.provider_key,
      postId: String(fact.values.post_id),
      postedAt: (fact.values.posted_at as string | null) ?? null,
      format: (fact.values.format as string | null) ?? null,
      link: (fact.values.link as string | null) ?? null,
      captionExcerpt: (fact.values.caption_excerpt as string | null) ?? null,
      reach: typeof fact.values.reach === "number" ? fact.values.reach : null,
      impressions:
        typeof fact.values.impressions === "number" ? fact.values.impressions : null,
      engagements:
        typeof fact.values.engagements === "number" ? fact.values.engagements : null,
      clicks: typeof fact.values.clicks === "number" ? fact.values.clicks : null,
      videoViews:
        typeof fact.values.video_views === "number" ? fact.values.video_views : null,
      sourceFetchedAt: fact.sourceFetchedAt,
    }));

  const rowsWritten = await upsertSocialPostMetrics(context.db, rows);
  return { rowsWritten, notes: result.notes, providerCalls: 1 };
};