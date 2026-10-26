import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

/**
 * The schema is applied to a real PostgreSQL.
 *
 * PGlite is PostgreSQL compiled to WebAssembly, so the parser, the planner
 * and the function bodies are the real ones. Every migration and the repair
 * file are executed against it, so a SQL error cannot reach the Supabase
 * SQL editor.
 *
 * This test earned its place. It found three real faults that the unit
 * tests could not see:
 *
 *   1. a bare `{...}` array literal in the repair file, which is a syntax
 *      error inside a `VALUES` row;
 *   2. two unclosed `array[` constructors in the seed migration, which
 *      terminated their rows a column early;
 *   3. an alias mismatch in the reconcile migration (`p.permission` where
 *      the row was aliased `r`).
 *
 * None of them were visible from the TypeScript, and all three would have
 * stopped the owner on the first run.
 */

const AUTH_STUB = `
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
  -- The test sets a session variable to stand in for the signed-in user.
  -- Supabase's real auth.uid() reads the request's JWT claim; the shape of
  -- the answer is the same, which is what the policies depend on.
  select nullif(current_setting('ccm.test_user', true), '')::uuid;
$$;

grant usage on schema auth to public;
grant select on auth.users to public;
`;

/** Split a SQL file into statements, respecting every quoting form. */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  let inDollar = false;
  let tag = "";

  while (i < sql.length) {
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

    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      current += sql.slice(i, stop);
      i = stop;
      continue;
    }

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

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.waitReady;
}, 120_000);

afterAll(async () => {
  await db?.close();
});

async function execFile(label: string, path: string) {
  const sql = readFileSync(path, "utf8");
  const statements = splitStatements(sql);

  for (let index = 0; index < statements.length; index += 1) {
    try {
      await db.exec(statements[index]!);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `${label} — statement ${index + 1} failed: ${message}\n\n` +
          statements[index]!.split("\n").slice(0, 8).join("\n"),
      );
    }
  }
}

describe("the schema applies to a real PostgreSQL", () => {
  it("creates the Supabase roles and the auth stub", async () => {
    for (const statement of splitStatements(AUTH_STUB)) {
      await db.exec(statement);
    }

    const { rows } = await db.query<{ count: string }>(
      "select count(*)::text as count from pg_roles where rolname in ('anon','authenticated','service_role')",
    );
    expect(rows[0]?.count).toBe("3");
  });

  it("applies every migration in order", async () => {
    const files = readdirSync("supabase/migrations")
      .filter((file) => file.endsWith(".sql"))
      .sort();

    expect(files.length).toBeGreaterThanOrEqual(13);

    for (const file of files) {
      await execFile(file, `supabase/migrations/${file}`);
    }
  });

  it("applies the repair, and it is idempotent", async () => {
    await execFile("repair.sql", "supabase/repair.sql");
    // Running it a second time must change nothing and must not fail.
    await execFile("repair.sql (second run)", "supabase/repair.sql");
  });

  it("installs the authorisation layer", async () => {
    const { rows } = await db.query<{ count: string }>(
      `select count(*)::text as count from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in ('has_permission','can_access_account','can_read_metric',
                          'is_workspace_member','metric_permission',
                          'add_provider_quota_usage','has_provider_quota')`,
    );
    expect(Number(rows[0]?.count)).toBe(7);

    const policies = await db.query<{ count: string }>(
      "select count(*)::text as count from pg_policies where schemaname = 'public'",
    );
    expect(Number(policies.rows[0]?.count)).toBeGreaterThanOrEqual(67);
  });

  it("keeps saved logins and credential tickets server-only", async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('account_login_credentials', 'account_login_access_tickets')
        order by c.relname`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);

    for (const table of ["account_login_credentials", "account_login_access_tickets"]) {
      const { rows: privileges } = await db.query<{ can_read: boolean; can_write: boolean }>(
        `select has_table_privilege('authenticated', $1, 'select') as can_read,
                has_table_privilege('authenticated', $1, 'insert,update,delete') as can_write`,
        [`public.${table}`],
      );
      expect(privileges[0]?.can_read, table).toBe(false);
      expect(privileges[0]?.can_write, table).toBe(false);
    }
  });

  it("seeds the registry exactly", async () => {
    // The role grants are per workspace, so a workspace has to exist before
    // they can be counted.
    await db.exec(
      "insert into public.workspaces (name, slug) values ('SQL test', 'sql-test');",
    );

    for (const [table, expected] of [
      ["roles", 8],
      ["provider_definitions", 14],
      ["metric_definitions", 22],
    ] as const) {
      const { rows } = await db.query<{ count: string }>(
        `select count(*)::text as count from public.${table}`,
      );
      expect(Number(rows[0]?.count), table).toBe(expected);
    }

    // The grants, per workspace.
    const { rows: grantRows } = await db.query<{ count: string }>(
      `select count(*)::text as count
         from public.role_permissions rp
         join public.workspaces w on w.id = rp.workspace_id
        where w.slug = 'sql-test'`,
    );
    expect(Number(grantRows[0]?.count), "role_permissions").toBe(103);
  });

  it("gives every provider a host array", async () => {
    const { rows } = await db.query<{ key: string; hosts: string[] }>(
      "select key, hosts from public.provider_definitions",
    );
    expect(rows).toHaveLength(14);
    for (const row of rows) {
      expect(Array.isArray(row.hosts), row.key).toBe(true);
      expect(row.hosts.length, row.key).toBeGreaterThan(0);
    }
  });

  it("keys provider app credentials by OAuth app, including the Google umbrella app", async () => {
    await db.exec(`
      insert into public.provider_app_credentials
        (workspace_id, provider_key, client_id)
      select id, 'google', 'test-client'
        from public.workspaces where slug = 'sql-test';
    `);
    const { rows } = await db.query<{ provider_key: string }>(
      "select provider_key from public.provider_app_credentials where client_id = 'test-client'",
    );
    expect(rows).toEqual([{ provider_key: "google" }]);
    await expect(db.exec(`
      insert into public.provider_app_credentials
        (workspace_id, provider_key, client_id)
      select id, 'unknown-oauth-app', 'bad-client'
        from public.workspaces where slug = 'sql-test';
    `)).rejects.toThrow();
  });

  it("creates the digests and counts the quota", async () => {
    await db.exec(
      "insert into public.workspaces (name, slug) values ('Medical Bay', 'medical-bay');",
    );

    // The digests belong to a workspace, and the trigger creates them with
    // the workspace.
    const { rows: digests } = await db.query<{ count: string }>(
      `select count(*)::text as count
         from public.report_definitions d
         join public.workspaces w on w.id = d.workspace_id
        where w.slug = 'medical-bay'`,
    );
    expect(Number(digests[0]?.count)).toBe(3);

    const { rows: cadenceRows } = await db.query<{ cadence: string }>(
      `select d.cadence
         from public.report_definitions d
         join public.workspaces w on w.id = d.workspace_id
        where w.slug = 'medical-bay'
        order by d.cadence`,
    );
    expect(cadenceRows.map((row) => row.cadence)).toEqual([
      "daily",
      "monthly",
      "weekly",
    ]);

    const { rows: connectionRows } = await db.query<{ id: string }>(
      `insert into public.provider_connections (workspace_id, provider_key, display_label, quota_limit)
       select id, 'ahrefs', 'Ahrefs', 100 from public.workspaces limit 1 returning id`,
    );
    const connectionId = connectionRows[0]!.id;

    await db.query("select public.add_provider_quota_usage($1, 5)", [connectionId]);

    const { rows: quotaRows } = await db.query<{ quota_used: number }>(
      "select quota_used from public.provider_connections where id = $1",
      [connectionId],
    );
    expect(quotaRows[0]?.quota_used).toBe(5);
  });
});

/**
 * The Row Level Security policies, exercised for real.
 *
 * The policies are the authorisation layer: a mistake here is a data leak,
 * so they are tested against a real PostgreSQL with the real roles, the real
 * grants and the real `SECURITY DEFINER` helpers. The user is stood in for
 * by a session variable that `auth.uid()` reads.
 */
describe("the Row Level Security policies", () => {
  const user = (name: string) =>
    `insert into auth.users (id, email) values (gen_random_uuid(), '${name}@ccm.test.local') returning id`;

  /** Run a query as a signed-in user. */
  async function asUser<T>(
    userId: string,
    sql: string,
  ): Promise<T[]> {
    await db.exec("reset role;");
    await db.query("select set_config('ccm.test_user', $1, false)", [userId]);
    await db.exec("set role authenticated;");
    try {
      const { rows } = await db.query<T>(sql);
      return rows;
    } finally {
      await db.exec("reset role;");
    }
  }

  it("lets a launcher reader see accounts without granting API integrations access", async () => {
    const { rows: workspaceRows } = await db.query<{ id: string }>(
      "insert into public.workspaces (name, slug) values ('Launcher reader', 'launcher-reader') returning id",
    );
    const workspaceId = workspaceRows[0]!.id;
    const { rows: userRows } = await db.query<{ id: string }>(user("launcher-reader"));
    const userId = userRows[0]!.id;

    await db.query(
      "insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'read_only', 'active')",
      [workspaceId, userId],
    );
    await db.query(
      `insert into public.external_accounts (workspace_id, provider_key, display_label)
       values ($1, 'gmail', 'Browser mailbox')`,
      [workspaceId],
    );

    const accounts = await asUser<{ display_label: string }>(
      userId,
      "select display_label from public.external_accounts",
    );
    expect(accounts.map((row) => row.display_label)).toEqual(["Browser mailbox"]);

    const integrations = await asUser<{ count: string }>(
      userId,
      "select count(*)::text as count from public.provider_connections",
    );
    expect(integrations[0]?.count).toBe("0");
  });

  it("gives a read-only member the connection catalogue, and nothing private", async () => {
    const { rows: workspaceRows } = await db.query<{ id: string }>(
      "insert into public.workspaces (name, slug) values ('RLS A', 'rls-a') returning id",
    );
    const workspaceId = workspaceRows[0]!.id;

    const { rows: readerRows } = await db.query<{ id: string }>(user("reader"));
    const readerId = readerRows[0]!.id;

    await db.query(
      "insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'read_only', 'active')",
      [workspaceId, readerId],
    );

    await db.query(
      `insert into public.external_accounts (workspace_id, provider_key, display_label)
       values ($1, 'ga4', 'A GA4')`,
      [workspaceId],
    );

    await db.query(
      `insert into public.provider_connections (workspace_id, provider_key, display_label)
       values ($1, 'ga4', 'A GA4')`,
      [workspaceId],
    );

    // The catalogue is readable.
    const connections = await asUser<{ display_label: string }>(
      readerId,
      "select display_label from public.provider_connections",
    );
    expect(connections.map((row) => row.display_label)).toEqual(["A GA4"]);

    // The credential is not, and never is.
    const credentials = await asUser<{ count: string }>(
      readerId,
      "select count(*)::text as count from public.provider_connection_credentials",
    );
    expect(credentials[0]?.count).toBe("0");

    // The audit log needs its own permission.
    const audit = await asUser<{ count: string }>(
      readerId,
      "select count(*)::text as count from public.audit_events",
    );
    expect(audit[0]?.count).toBe("0");
  });

  it("scopes an account-scoped role to exactly the account it was granted", async () => {
    const { rows: workspaceRows } = await db.query<{ id: string }>(
      "insert into public.workspaces (name, slug) values ('RLS B', 'rls-b') returning id",
    );
    const workspaceId = workspaceRows[0]!.id;

    const { rows: userRows } = await db.query<{ id: string }>(user("mailbox"));
    const mailboxUserId = userRows[0]!.id;

    await db.query(
      "insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'mailbox_user', 'active')",
      [workspaceId, mailboxUserId],
    );

    const { rows: accountRows } = await db.query<{ id: string }>(
      `insert into public.external_accounts (workspace_id, provider_key, display_label)
       values ($1, 'gmail', 'Mailbox A'), ($1, 'gmail', 'Mailbox B') returning id`,
      [workspaceId],
    );
    const [accountA, accountB] = accountRows;

    await db.query(
      `insert into public.external_account_grants (external_account_id, user_id, permission)
       values ($1, $2, 'inbox.read'), ($1, $2, 'inbox.send')`,
      [accountA!.id, mailboxUserId],
    );

    await db.query(
      `insert into public.mailbox_connections (workspace_id, account_id, provider_key, mailbox_email, display_label, status)
       values ($1, $2, 'gmail', 'a@example.test', 'Mailbox A', 'connected'),
              ($1, $3, 'gmail', 'b@example.test', 'Mailbox B', 'connected')`,
      [workspaceId, accountA!.id, accountB!.id],
    );

    // Only the granted account.
    const accounts = await asUser<{ display_label: string }>(
      mailboxUserId,
      "select display_label from public.external_accounts order by display_label",
    );
    expect(accounts.map((row) => row.display_label)).toEqual(["Mailbox A"]);

    // Only the granted mailbox.
    const mailboxes = await asUser<{ display_label: string }>(
      mailboxUserId,
      "select display_label from public.mailbox_connections order by display_label",
    );
    expect(mailboxes.map((row) => row.display_label)).toEqual(["Mailbox A"]);

    // The account-scoped role does not get the connection catalogue.
    const connections = await asUser<{ count: string }>(
      mailboxUserId,
      "select count(*)::text as count from public.provider_connections",
    );
    expect(connections[0]?.count).toBe("0");
  });

  it("keeps a member of another workspace out", async () => {
    const { rows: userRows } = await db.query<{ id: string }>(user("outsider"));
    const outsiderId = userRows[0]!.id;

    const accounts = await asUser<{ count: string }>(
      outsiderId,
      "select count(*)::text as count from public.external_accounts",
    );
    expect(accounts[0]?.count).toBe("0");

    const mailboxes = await asUser<{ count: string }>(
      outsiderId,
      "select count(*)::text as count from public.mailbox_connections",
    );
    expect(mailboxes[0]?.count).toBe("0");
  });

  it("lets only an owner create a workspace and gives the creator ownership", async () => {
    const { rows: sourceRows } = await db.query<{ id: string }>(
      "insert into public.workspaces (name, slug) values ('Owner source', 'owner-source') returning id",
    );
    const sourceId = sourceRows[0]!.id;
    const { rows: ownerRows } = await db.query<{ id: string }>(user("workspace-owner"));
    const ownerId = ownerRows[0]!.id;
    await db.query(
      "insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'owner', 'active')",
      [sourceId, ownerId],
    );

    const created = await asUser<{ id: string; name: string }>(
      ownerId,
      "select * from public.create_workspace_for_owner('Client portfolio')",
    );
    expect(created[0]?.name).toBe("Client portfolio");
    const membership = await db.query<{ role: string; status: string }>(
      "select role, status from public.workspace_members where workspace_id = $1 and user_id = $2",
      [created[0]!.id, ownerId],
    );
    expect(membership.rows[0]).toEqual({ role: "owner", status: "active" });

    const { rows: memberRows } = await db.query<{ id: string }>(user("workspace-member"));
    const memberId = memberRows[0]!.id;
    await db.query(
      "insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'admin', 'active')",
      [created[0]!.id, memberId],
    );
    const memberRename = await asUser<{ id: string }>(
      memberId,
      `update public.workspaces set name = 'Admin rename' where id = '${created[0]!.id}' returning id`,
    );
    expect(memberRename).toHaveLength(0);
    const ownerRename = await asUser<{ id: string }>(
      ownerId,
      `update public.workspaces set name = 'Owner rename' where id = '${created[0]!.id}' returning id`,
    );
    expect(ownerRename).toHaveLength(1);

    await db.query(
      "insert into public.workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'admin', 'active')",
      [sourceId, memberId],
    );
    await expect(
      asUser(memberId, "select * from public.create_workspace_for_owner('Not allowed')"),
    ).rejects.toThrow(/Only a workspace owner/);
  });
});
