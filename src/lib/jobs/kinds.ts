/**
 * The job kinds.
 *
 * This list is the authority for three things at once:
 *
 *   - the `sync_job_kind` enum in the database;
 *   - the handler registry, so a job kind with no handler is a mistake
 *     rather than a silent no-op;
 *   - the repair file, so the enum and the code cannot drift.
 *
 * A kind that is enqueued but is not in the enum fails at the database, with
 * a message that says nothing useful. That is why the list lives here and
 * the SQL is generated from it.
 */
export const SYNC_JOB_KINDS = [
  // Provider syncs.
  "ga4.sessions",
  "ga4.events",
  "gsc.query",
  "ads.campaign",
  "ads.search_terms",
  "gtm.inventory",
  "pagespeed.run",
  "uptime.check",
  "social.snapshot",
  "social.posts",
  "rank.snapshot",
  "mail.sync",
  "site.crawl",

  // CCM's own work.
  "alerts.evaluate",
  "retention.prune",
  "reports.generate",
] as const;

export type SyncJobKind = (typeof SYNC_JOB_KINDS)[number];

/** Whether a string is one of the known job kinds. */
export function isSyncJobKind(value: string): value is SyncJobKind {
  return (SYNC_JOB_KINDS as readonly string[]).includes(value);
}

/**
 * The enum, rendered for SQL.
 *
 * The values are quoted, so a kind can never break the statement.
 */
export function syncJobKindSql(): string {
  return SYNC_JOB_KINDS.map((kind) => `'${kind}'`).join(", ");
}
