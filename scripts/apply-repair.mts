/**
 * Apply `supabase/repair.sql` to a Supabase project through the Management
 * API.
 *
 * The Management API needs a personal access token with write access to the
 * project. Create one at https://supabase.com/dashboard/account/tokens and
 * export it:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/apply-repair.mts
 *
 * The project reference is read from `.env` (NEXT_PUBLIC_SUPABASE_URL) or
 * from `SUPABASE_PROJECT_REF`.
 *
 * This only runs DDL. It is idempotent, so running it against a healthy
 * project changes nothing.
 */
import { readFileSync } from "node:fs";

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
const token = env.SUPABASE_ACCESS_TOKEN;
const sql = readFileSync("supabase/repair.sql", "utf8");

if (!token) {
  console.error(
    "SUPABASE_ACCESS_TOKEN is not set.\n" +
      "Create a personal access token at " +
      "https://supabase.com/dashboard/account/tokens and export it, " +
      "or paste supabase/repair.sql into the Supabase SQL editor.",
  );
  process.exit(1);
}

const projectRef =
  env.SUPABASE_PROJECT_REF ??
  (env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : undefined);

if (!projectRef) {
  console.error(
    "Could not determine the project reference. Set SUPABASE_PROJECT_REF.",
  );
  process.exit(1);
}

console.log(`applying supabase/repair.sql to ${projectRef}`);

const response = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);

const body = await response.text();

if (!response.ok) {
  console.error(`the Management API returned ${response.status}:`);
  console.error(body.slice(0, 2000));
  process.exit(1);
}

console.log("applied.");
console.log(body.slice(0, 500));
