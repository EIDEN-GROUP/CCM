/**
 * Apply the seed data to a database through the service-role client.
 *
 * Use this when the SQL migrations have not been applied — for example when
 * the permission matrix is missing, which leaves every user unable to read
 * anything. The operation is idempotent: existing rows are updated, not
 * duplicated.
 *
 * It writes to the `roles`, `role_permissions`, `provider_definitions` and
 * `metric_definitions` tables only.
 *
 *   npx tsx scripts/seed-database.mts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import {
  METRIC_SEED,
  PROVIDER_SEED,
  ROLE_PERMISSION_SEED,
  ROLE_SEED,
} from "../src/domain/seed";

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
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;

function report(step: string, error: { message: string } | null) {
  if (error) {
    failures += 1;
    console.error(`  ✗ ${step}: ${error.message}`);
  } else {
    console.log(`  ✓ ${step}`);
  }
}

// --- Roles ------------------------------------------------------------------

console.log("roles");
const { error: roleError } = await db
  .from("roles")
  .upsert(ROLE_SEED as unknown as never[], { onConflict: "key" });
report(`${ROLE_SEED.length} roles`, roleError);

// --- Permission matrix ------------------------------------------------------

console.log("role_permissions");
const permissionRows = Object.entries(ROLE_PERMISSION_SEED).flatMap(
  ([role, permissions]) =>
    permissions.map((permission) => ({ role, permission })),
);
const { error: permissionError } = await db
  .from("role_permissions")
  .upsert(permissionRows as unknown as never[], {
    onConflict: "role,permission",
    ignoreDuplicates: true,
  });
report(`${permissionRows.length} permissions`, permissionError);

// --- Provider catalogue -----------------------------------------------------

console.log("provider_definitions");
const { error: providerError } = await db
  .from("provider_definitions")
  .upsert(
    PROVIDER_SEED.map((provider) => ({
      ...provider,
      capabilities: [],
    })) as unknown as never[],
    { onConflict: "key" },
  );
report(`${PROVIDER_SEED.length} providers`, providerError);

// --- Metric registry --------------------------------------------------------

console.log("metric_definitions");
const { error: metricError } = await db
  .from("metric_definitions")
  .upsert(METRIC_SEED as unknown as never[], { onConflict: "key" });
report(`${METRIC_SEED.length} metrics`, metricError);

// --- Verify -----------------------------------------------------------------

const { count: roleCount } = await db
  .from("roles")
  .select("key", { count: "exact", head: true });
const { count: permissionCount } = await db
  .from("role_permissions")
  .select("role", { count: "exact", head: true });
const { count: providerCount } = await db
  .from("provider_definitions")
  .select("key", { count: "exact", head: true });
const { count: metricCount } = await db
  .from("metric_definitions")
  .select("key", { count: "exact", head: true });

console.log("\nverified:");
console.log(`  roles              ${roleCount}`);
console.log(`  role_permissions   ${permissionCount}`);
console.log(`  providers          ${providerCount}`);
console.log(`  metrics            ${metricCount}`);

if (failures > 0) {
  console.error(`\n${failures} step(s) failed.`);
  process.exit(1);
}
console.log("\nSeed applied.");
