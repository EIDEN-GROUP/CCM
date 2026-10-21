import type { JobHandler } from "@/lib/jobs/runner";
import { toConnectorAccount, windowFor } from "./google";
import { PageSpeedConnector } from "@/providers/web/pagespeed";
import { UptimeConnector } from "@/providers/web/uptime";
import { insertSiteHealthCheck } from "@/lib/providers/upsert";

/**
 * The site health handlers.
 *
 * Both write to `site_health_checks`, which is a **history** rather than a
 * daily series: a check is a point in time, and the point of keeping them
 * is to see whether the answer changed.
 */

export const pageSpeedHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job, 1);

  const strategy =
    (context.job.payload as { strategy?: "mobile" | "desktop" }).strategy ??
    (context.job.payload as { device?: "mobile" | "desktop" }).device ??
    "mobile";

  const connector = new PageSpeedConnector({
    apiKey: process.env.PAGESPEED_API_KEY,
  });

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "pagespeed", device: strategy },
    { accessToken: context.accessToken },
  );

  const fact = result.facts[0];
  if (!fact) return { rowsWritten: 0, notes: result.notes };

  const websiteId =
    (context.job.payload as { websiteId?: string }).websiteId ??
    context.account.id;

  const performance = fact.values.performance_score;

  await insertSiteHealthCheck(context.db, {
    workspaceId: context.job.workspace_id,
    websiteId,
    checkType: "pagespeed",
    // A null score is "not measured", which is not the same as a zero score.
    status:
      typeof performance === "number"
        ? performance >= 0.9
          ? "good"
          : performance >= 0.5
            ? "needs_attention"
            : "poor"
        : "unknown",
    checkedAt: fact.sourceFetchedAt,
    value: typeof performance === "number" ? performance : null,
    unit: "score",
    detail: {
      url: fact.values.url ?? null,
      strategy,
      accessibility_score: fact.values.accessibility_score ?? null,
      best_practices_score: fact.values.best_practices_score ?? null,
      seo_score: fact.values.seo_score ?? null,
      lcp_ms: fact.values.lcp_ms ?? null,
      fcp_ms: fact.values.fcp_ms ?? null,
      cls: fact.values.cls ?? null,
      tbt_ms: fact.values.tbt_ms ?? null,
      speed_index_ms: fact.values.speed_index_ms ?? null,
      field_overall_category: fact.values.field_overall_category ?? null,
      field_lcp_ms: fact.values.field_lcp_ms ?? null,
      field_fcp_ms: fact.values.field_fcp_ms ?? null,
      field_cls: fact.values.field_cls ?? null,
    },
  });

  return { rowsWritten: 1, notes: result.notes, providerCalls: 1 };
};

export const uptimeHandler: JobHandler = async (context) => {
  const { startDate, endDate } = windowFor(context.job, 1);

  const connector = new UptimeConnector();

  const result = await connector.readReport(
    toConnectorAccount(context.account),
    { startDate, endDate, dimension: "uptime" },
    { accessToken: context.accessToken },
  );

  const fact = result.facts[0];
  if (!fact) return { rowsWritten: 0, notes: result.notes };

  const websiteId =
    (context.job.payload as { websiteId?: string }).websiteId ??
    context.account.id;

  const reachable = fact.values.reachable === true;
  const daysRemaining = fact.values.tls_days_remaining;

  await insertSiteHealthCheck(context.db, {
    workspaceId: context.job.workspace_id,
    websiteId,
    checkType: "uptime",
    status: reachable ? "reachable" : "unreachable",
    checkedAt: fact.sourceFetchedAt,
    value:
      typeof fact.values.status_code === "number"
        ? fact.values.status_code
        : null,
    unit: "http_status",
    detail: {
      url: fact.values.url ?? null,
      hostname: fact.values.hostname ?? null,
      response_ms: fact.values.response_ms ?? null,
      error: fact.values.error ?? null,
      tls_valid: fact.values.tls_valid ?? null,
      tls_issuer: fact.values.tls_issuer ?? null,
      tls_subject: fact.values.tls_subject ?? null,
      tls_valid_to: fact.values.tls_valid_to ?? null,
      tls_days_remaining: daysRemaining ?? null,
      tls_protocol: fact.values.tls_protocol ?? null,
      tls_error: fact.values.tls_error ?? null,
    },
  });

  if (typeof daysRemaining === "number") {
    await insertSiteHealthCheck(context.db, {
      workspaceId: context.job.workspace_id,
      websiteId,
      checkType: "ssl",
      status:
        daysRemaining < 0
          ? "expired"
          : daysRemaining < 14
            ? "expiring"
            : "valid",
      checkedAt: fact.sourceFetchedAt,
      value: daysRemaining,
      unit: "days_remaining",
      detail: {
        valid_to: fact.values.tls_valid_to ?? null,
        issuer: fact.values.tls_issuer ?? null,
        subject: fact.values.tls_subject ?? null,
        protocol: fact.values.tls_protocol ?? null,
      },
    });
  }

  // One HTTP request and one TLS handshake.
  return { rowsWritten: 2, notes: result.notes, providerCalls: 2 };
};