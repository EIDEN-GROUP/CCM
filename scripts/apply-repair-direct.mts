/**
 * Apply `supabase/repair.sql` over a direct Postgres connection.
 *
 * The Management API route in `apply-repair.mts` needs a personal access
 * token. This route uses the project's own `DATABASE_URL` instead, which is
 * what a direct connection is for.
 *
 *   npx tsx scripts/apply-repair-direct.mts
 *
 * The whole file runs in one transaction, so a failure leaves the database
 * exactly as it was. The file is idempotent, so running it against a
 * healthy project changes nothing.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

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

async function main() {
  const env = loadEnv();
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    console.error(
      "DATABASE_URL is not set. Add it to .env (postgresql://... with the\n" +
        "pooler password) or use the Management API route instead:\n" +
        "  SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/apply-repair.mts",
    );
    process.exit(1);
  }

  const sql = readFileSync("supabase/repair.sql", "utf8");

  const client = new Client({
    connectionString,
    // The Supabase pooler sits behind a transaction-mode proxy, and the
    // repair opens a transaction of its own.
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("connected");

    await client.query(sql);
    console.log("repair applied");

    // The file ends with a reload notification; verify the layer is there.
    const { rows } = await client.query<{ count: string }>(
      "select count(*)::text as count from pg_proc where pronamespace = 'public'::regnamespace and proname in ('has_permission','can_access_account','can_read_metric','is_workspace_member','add_provider_quota_usage')",
    );
    console.log(`helper functions present: ${rows[0]?.count}`);

    const { rows: policyRows } = await client.query<{ count: string }>(
      "select count(*)::text as count from pg_policies where schemaname = 'public'",
    );
    console.log(`policies present: ${policyRows[0]?.count}`);

    const { rows: tableRows } = await client.query<{ count: string }>(
      "select count(*)::text as count from information_schema.tables where table_schema = 'public'",
    );
    console.log(`public tables: ${tableRows[0]?.count}`);

    process.exit(0);
  } catch (error) {
    console.error("the repair failed:", error instanceof Error ? error.message : error);
    if (error && typeof error === "object" && "position" in error) {
      console.error(`at position ${String(error.position)}`);
    }
    if (error && typeof error === "object" && "where" in error) {
      console.error(`near: ${String(error.where)}`);
    }
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main();
