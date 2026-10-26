/**
 * CCM doctor.
 *
 * One command that reports the state of everything the owner needs to fix:
 * environment variables, the launch signing key, the database schema, the
 * Row Level Security authorisation layer, and the seed data.
 *
 *   npm run doctor
 *
 * It performs read-only checks, except that it verifies the *shape* of the
 * launch key by importing it — which never leaves the process.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { importPKCS8, importSPKI } from "jose";
import { normalisePem } from "../src/lib/launch/tickets";

function loadEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  for (const file of [".env.local", ".env"]) {
    let content: string;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      let value = match[2]!.trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      values[match[1]!] = value;
    }
    break;
  }
  return { ...values, ...process.env };
}

const env = loadEnv();

let problems = 0;
let warnings = 0;

function ok(label: string, detail = "") {
  console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? ` \x1b[90m${detail}\x1b[0m` : ""}`);
}
function warn(label: string, detail: string) {
  warnings += 1;
  console.log(`  \x1b[33m!\x1b[0m ${label}\n      ${detail}`);
}
function bad(label: string, detail: string) {
  problems += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${label}\n      ${detail}`);
}
function section(name: string) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

// --- 1. Environment ---------------------------------------------------------

section("Environment");

const REQUIRED: Array<[string, boolean]> = [
  ["NEXT_PUBLIC_SUPABASE_URL", true],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", true],
  ["SUPABASE_SERVICE_ROLE_KEY", true],
  ["APP_ENCRYPTION_KEY", true],
  ["CRON_SECRET", true],
  ["LAUNCH_SIGNING_PRIVATE_KEY", true],
  ["LAUNCH_SIGNING_PUBLIC_KEY", true],
];

const OPTIONAL: Array<[string, string]> = [
  ["DATABASE_URL", "direct Postgres connection, for migrations and psql"],
  ["GOOGLE_CLOUD_PROJECT_ID", "GA4, Search Console, GTM, Ads, YouTube"],
  ["GOOGLE_OAUTH_CLIENT_ID", "Google OAuth client"],
  ["GOOGLE_OAUTH_CLIENT_SECRET", "Google OAuth client"],
  ["GA4_PROPERTY_ID", "GA4 property"],
  ["GSC_PROPERTY_URL", "Search Console property"],
  ["GTM_CONTAINER_ID", "Tag Manager container"],
  ["GOOGLE_ADS_CUSTOMER_ID", "Google Ads customer"],
  ["META_APP_ID", "Meta / Instagram app"],
  ["LINKEDIN_CLIENT_ID", "LinkedIn app"],
  ["AHREFS_API_KEY", "rank tracking"],
  ["GEMINI_API_KEY", "AI analyst"],
];

for (const [name] of REQUIRED) {
  const value = env[name];
  if (!value) {
    bad(`${name} is missing`, "Required. See .env.example.");
  } else if (value.includes("REDACTED")) {
    bad(`${name} is a placeholder`, "The value is still *****REDACTED*****.");
  } else {
    ok(name);
  }
}

for (const [name, purpose] of OPTIONAL) {
  const value = env[name];
  if (!value) {
    warn(`${name} is not set`, `Needed for: ${purpose}.`);
  } else if (value.includes("REDACTED")) {
    warn(`${name} is a placeholder`, `Needed for: ${purpose}.`);
  } else {
    ok(name);
  }
}

// --- 2. Launch signing key --------------------------------------------------

section("Launch signing key");

const privatePem = env.LAUNCH_SIGNING_PRIVATE_KEY;
const publicPem = env.LAUNCH_SIGNING_PUBLIC_KEY;

if (!privatePem || !publicPem) {
  bad("the launch key pair is incomplete", "Run: npm run keys:launch");
} else {
  try {
    await importPKCS8(normalisePem(privatePem), "ES256");
    await importSPKI(normalisePem(publicPem), "ES256");
    ok("the key pair imports", "ES256 / P-256");
  } catch (error) {
    bad(
      "the launch key pair could not be imported",
      `${error instanceof Error ? error.message : String(error)}. The value is most likely truncated — a P-256 public key PEM carries 124 base64 characters and a private key 244. Run: npm run keys:launch`,
    );
  }
}

// --- 3. Database ------------------------------------------------------------

section("Database");

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || url.includes("REDACTED")) {
  bad("Supabase is not configured", "Nothing below could be checked.");
} else {
  const db = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const TABLES = [
    "workspaces",
    "workspace_members",
    "roles",
    "role_permissions",
    "websites",
    "provider_connections",
    "provider_connection_credentials",
    "external_accounts",
    "account_launch_profiles",
    "launch_tickets",
    "launch_events",
    "sync_jobs",
    "daily_ads_metrics",
    "daily_ga4_metrics",
    "daily_gsc_metrics",
    "alerts",
    "alert_rules",
    "action_items",
    "mailbox_connections",
    "audit_events",
  ];

  const missingTables: string[] = [];
  for (const table of TABLES) {
    const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (response.status === 404) missingTables.push(table);
  }

  if (missingTables.length === 0) {
    ok("every CCM table exists");
  } else {
    bad(
      `${missingTables.length} table(s) are missing`,
      `${missingTables.join(", ")}. Apply supabase/repair.sql.`,
    );
  }

  // The authorisation layer.
  const rpc = await fetch(`${url}/rest/v1/rpc/has_permission`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      target_workspace: "00000000-0000-0000-0000-000000000000",
      perm: "overview.read",
    }),
  });

  if (rpc.status === 404) {
    bad(
      "the Row Level Security authorisation layer is not installed",
      "Every signed-in user will see an empty product. Apply supabase/repair.sql — it creates the helper functions, every policy and the seed, then reloads PostgREST's schema cache.",
    );
  } else if (rpc.status >= 500) {
    bad("the authorisation layer check failed", `The database returned ${rpc.status}.`);
  } else {
    ok("the Row Level Security authorisation layer is installed");
  }

  // The seed.
  for (const [table, expected] of [
    ["roles", 8],
    ["role_permissions", 97],
    ["provider_definitions", 13],
    ["metric_definitions", 22],
  ] as const) {
    const { count } = await db
      .from(table)
      .select("*", { count: "exact", head: true });
    if (count === expected) {
      ok(`${table}: ${count} row(s)`);
    } else {
      warn(
        `${table}: ${count ?? 0} row(s), expected ${expected}`,
        "Run: npm run db:seed",
      );
    }
  }
}

// --- 5. Optional surfaces ---------------------------------------------------

section("Optional surfaces");

if (env.CCM_DEMO_MODE === "1") {
  if (env.NODE_ENV === "production") {
    bad(
      "demo mode is on in production",
      "CCM_DEMO_MODE=1 serves synthetic fixtures. It must never be enabled in production — unset it.",
    );
  } else {
    warn(
      "demo mode is on",
      "Synthetic fixtures are being served. Every screen carries a demo banner, and exports are labelled.",
    );
  }
} else {
  ok("demo mode is off");
}

if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
  ok("the Google OAuth client is configured");
} else {
  warn(
    "the Google OAuth client is not configured",
    "Needed for: connecting GA4, Search Console, GTM, Ads, YouTube and Gmail from the Integrations screen.",
  );
}

// --- 6. Summary -------------------------------------------------------------

console.log(
  `\n\x1b[1mSummary\x1b[0m  ${problems} problem(s), ${warnings} warning(s)\n`,
);

if (problems > 0) {
  console.log(
    "The items marked ✗ stop CCM from working. The items marked ! are needed for a provider to report live data.\n",
  );
}
