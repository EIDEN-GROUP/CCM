/**
 * Validate `supabase/repair.sql` against a real PostgreSQL engine.
 *
 * The repair is applied to a real database before the owner ever sees it,
 * so a syntax error cannot reach the Supabase SQL editor. PGlite is
 * PostgreSQL compiled to WebAssembly, so the parser, the planner and the
 * function bodies are the real ones.
 *
 * The steps are:
 *   1. start an in-memory Postgres;
 *   2. create the `auth` schema the migrations expect, with a stub
 *      `auth.users` table and a stub `auth.uid()`;
 *   3. run every migration in order;
 *   4. run the repair, twice, to prove it is idempotent;
 *   5. report the helper functions, the policies and the seed counts.
 *
 *   npx tsx scripts/validate-repair.mts
 */
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const AUTH_STUB = `
-- Supabase creates these roles. The policies and grants reference them, so
-- they have to exist for the schema to be applied.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid;
$$;

grant usage on schema auth to public;
grant select on auth.users to public;
`;

/**
 * Split a SQL file into statements.
 *
 * It respects string literals, line comments, block comments and
 * dollar-quoted function bodies, so a `;` inside any of them does not end
 * a statement.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let inDollar = false;
  let tag = "";

  while (i < sql.length) {
    // Inside a dollar-quoted body, only the closing tag ends it.
    if (inDollar) {
      if (sql.startsWith(tag, i)) {
        current += tag;
        i += tag.length;
        inDollar = false;
        tag = "";
        continue;
      }
      current += sql[i];
      i += 1;
      continue;
    }

    // A string literal. A doubled quote is an escaped quote.
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // A line comment.
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // A block comment.
    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // The start of a dollar-quoted body.
    const dollar = sql.slice(i).match(/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/);
    if (dollar) {
      inDollar = true;
      tag = dollar[0];
      current += tag;
      i += tag.length;
      continue;
    }

    if (sql[i] === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i += 1;
      continue;
    }

    current += sql[i];
    i += 1;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}

async function run(db: PGlite, label: string, sql: string) {
  const statements = splitStatements(sql);
  let index = 0;

  for (const statement of statements) {
    index += 1;
    try {
      await db.exec(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n✗ ${label} — statement ${index} failed:\n${message}`);

      if (error && typeof error === "object") {
        const record = error as Record<string, unknown>;
        if (typeof record.position === "number") {
          // Postgres reports a 1-based character offset into the statement.
          const offset = Number(record.position) - 1;
          const around = statement.slice(
            Math.max(0, offset - 120),
            Math.min(statement.length, offset + 120),
          );
          console.error(
            `\nAt character ${record.position} of the statement:\n${around}\n`,
          );
        }
        if (typeof record.detail === "string") {
          console.error(`detail: ${record.detail}\n`);
        }
      }

      const head = statement.split("\n").slice(0, 6).join("\n");
      console.error(`\nThe statement began:\n${head}\n`);
      throw error;
    }
  }

  console.log(`  ✓ ${label} (${statements.length} statements)`);
}

async function main() {
  const db = new PGlite();

  console.log("starting an in-memory PostgreSQL…");
  await db.waitReady;

  console.log("\n1. the auth stub");
  await run(db, "auth stub", AUTH_STUB);

  console.log("\n2. the migrations, in order");
  const migrationDir = "supabase/migrations";
  const files = readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    await run(db, file, readFileSync(`${migrationDir}/${file}`, "utf8"));
  }

  console.log("\n3. the repair, first run");
  const repair = readFileSync("supabase/repair.sql", "utf8");
  await run(db, "repair.sql", repair);

  console.log("\n4. the repair, second run (idempotence)");
  await run(db, "repair.sql (again)", repair);

  console.log("\n5. what is in the database now");
  const functions = await db.query<{ count: string }>(
    `select count(*)::text as count from pg_proc
      where pronamespace = 'public'::regnamespace
        and proname in ('has_permission','can_access_account','can_read_metric',
                        'is_workspace_member','metric_permission',
                        'add_provider_quota_usage','has_provider_quota')`,
  );
  console.log(`  helper functions: ${functions.rows[0]?.count}`);

  const policies = await db.query<{ count: string }>(
    "select count(*)::text as count from pg_policies where schemaname = 'public'",
  );
  console.log(`  policies: ${policies.rows[0]?.count}`);

  const tables = await db.query<{ count: string }>(
    `select count(*)::text as count from information_schema.tables
      where table_schema = 'public'`,
  );
  console.log(`  public tables: ${tables.rows[0]?.count}`);

  for (const [table, expected] of [
    ["roles", "8"],
    ["provider_definitions", "14"],
    ["metric_definitions", "22"],
  ] as const) {
    const rows = await db.query<{ count: string }>(
      `select count(*)::text as count from public.${table}`,
    );
    const actual = rows.rows[0]?.count;
    const mark = actual === expected ? "✓" : "✗";
    console.log(`  ${mark} ${table}: ${actual} (expected ${expected})`);
  }

  // The role grants belong to a workspace, and a trigger seeds them when the
  // workspace is created.
  await db.exec(
    "insert into public.workspaces (name, slug) values ('Validation', 'validation');",
  );
  const grantRows = await db.query<{ count: string }>(
    `select count(*)::text as count
       from public.role_permissions rp
       join public.workspaces w on w.id = rp.workspace_id
      where w.slug = 'validation'`,
  );
  const grantCount = grantRows.rows[0]?.count;
  console.log(
    `  ${grantCount === "103" ? "✓" : "✗"} role_permissions: ${grantCount} (expected 103)`,
  );

  // The digest definitions are created per workspace, so there are none
  // until a workspace exists.
  const digests = await db.query<{ count: string }>(
    "select count(*)::text as count from public.report_definitions",
  );
  console.log(`  report_definitions: ${digests.rows[0]?.count} (one per workspace)`);

  // With a workspace, each of the daily, weekly and monthly digests must
  // exist for it.
  await db.exec(
    "insert into public.workspaces (name, slug) values ('Medical Bay', 'medical-bay');",
  );
  const digestsWithWorkspace = await db.query<{ count: string }>(
    `select count(*)::text as count
       from public.report_definitions d
       join public.workspaces w on w.id = d.workspace_id
      where w.slug = 'medical-bay'`,
  );
  console.log(
    `  ${digestsWithWorkspace.rows[0]?.count === "3" ? "✓" : "✗"} report_definitions with a workspace: ${digestsWithWorkspace.rows[0]?.count} (expected 3)`,
  );

  // The quota function has to work, not merely exist.
  const { rows: connectionRows } = await db.query<{ id: string }>(
    "insert into public.provider_connections (workspace_id, provider_key, display_label, quota_limit) select id, 'ahrefs', 'Ahrefs', 100 from public.workspaces limit 1 returning id",
  );
  const connectionId = connectionRows[0]?.id;
  if (connectionId) {
    await db.query(
      "select public.add_provider_quota_usage($1, 5)",
      [connectionId],
    );
    const { rows: quotaRows } = await db.query<{ quota_used: number }>(
      "select quota_used from public.provider_connections where id = $1",
      [connectionId],
    );
    console.log(
      `  ${quotaRows[0]?.quota_used === 5 ? "✓" : "✗"} the quota counter increments (${quotaRows[0]?.quota_used})`,
    );
  }

  // The provider catalogue has to have real host arrays, not a null.
  const hosts = await db.query<{ key: string; hosts: string[] }>(
    "select key, hosts from public.provider_definitions order by key",
  );
  const bad = hosts.rows.filter((row) => !Array.isArray(row.hosts));
  console.log(
    `  ${bad.length === 0 ? "✓" : "✗"} every provider has a host array (${hosts.rows.length} providers)`,
  );

  await db.close();

  console.log("\n✓ the repair parses and runs, and it is idempotent.");
}

main().catch((error) => {
  console.error(
    "\n✗ the repair is not valid:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
