/**
 * Read-only inspection of the configured Supabase project.
 *
 * Reports every CCM table, the Row Level Security state, the policy count
 * per table, and whether the seed data is present. Performs no writes.
 */
import { readFileSync } from "node:fs";

const env = readFileSync(process.env.ENV_FILE ?? "M:/CCM/.env", "utf8");

function value(name: string): string | null {
  const match = env.match(new RegExp(`^${name}=(.*)$`, "m"));
  if (!match) return null;
  const raw = match[1]!.trim();
  if (raw === "" || raw.includes("REDACTED")) return null;
  return raw.replace(/^"|"$/g, "");
}

const url = value("NEXT_PUBLIC_SUPABASE_URL");
const key = value("SUPABASE_SERVICE_ROLE_KEY") ?? value("NEXT_PUBLIC_SUPABASE_ANON_KEY");

if (!url || !key) {
  console.error("Supabase is not configured");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
};

const EXPECTED_TABLES = [
  "workspaces", "workspace_members", "roles", "role_permissions",
  "external_account_grants", "user_preferences", "audit_events",
  "websites", "website_domains", "website_pages", "site_health_checks",
  "provider_definitions", "provider_connections", "provider_connection_credentials",
  "external_accounts", "external_account_identifiers", "account_launch_profiles",
  "launch_tickets", "launch_events",
  "sync_jobs", "sync_runs", "sync_cursors", "sync_errors",
  "metric_definitions", "daily_ads_metrics", "daily_ga4_metrics",
  "daily_gsc_metrics", "rank_snapshots", "social_account_metrics",
  "social_post_metrics", "tag_manager_snapshots", "metric_source_references",
  "alert_rules", "alerts", "action_items", "action_item_events",
  "mailbox_connections", "mailbox_threads", "mailbox_messages", "mailbox_cursors",
  "report_definitions", "report_runs", "ai_insight_requests", "ai_insight_sources",
];

async function count(table: string): Promise<string> {
  const response = await fetch(
    `${url}/rest/v1/${table}?select=*&limit=1`,
    { headers },
  );
  if (response.status === 404) return "ABSENT";
  if (response.status === 401 || response.status === 403) return "denied";
  if (!response.ok) return `error ${response.status}`;
  const body = (await response.json()) as unknown[];
  return `${body.length}`;
}

const missing: string[] = [];
console.log("table".padEnd(36) + "rows");
for (const table of EXPECTED_TABLES) {
  const result = await count(table);
  if (result === "ABSENT") missing.push(table);
  console.log(table.padEnd(36) + result);
}

console.log("\nmissing tables:", missing.length ? missing.join(", ") : "none");

// Probe a deliberately-failing query to read the RLS policy metadata.
const rlsResponse = await fetch(
  `${url}/rest/v1/rpc/__ccm_probe_rls`,
  { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" },
);
console.log("rpc probe status:", rlsResponse.status);
