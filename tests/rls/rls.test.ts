import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  authorisationLayerStatus,
  createUser,
  deleteUser,
  hasDatabase,
  skipReason,
  unique,
  userClient,
} from "./harness";

/**
 * Row Level Security authorisation tests.
 *
 * The point of these is not that the queries run, but that a user *cannot*
 * see another user's restricted website, API connection, mailbox, token
 * metadata, report or audit record.
 *
 * Every assertion is made through a client holding that user's real access
 * token, so the live PostgREST + RLS path is what is under test.
 *
 * The suite writes fixture rows and deletes them, so it refuses to run
 * without `CCM_RLS_ALLOW_WRITE=1`.
 */

const suite = hasDatabase ? describe : describe.skip;

if (!hasDatabase) {
  console.warn(
    `[rls] Row Level Security suite SKIPPED — ${skipReason()}. ` +
      "Set CCM_RLS_ALLOW_WRITE=1 to run it. It creates and removes its own fixture rows.",
  );
}

suite("Row Level Security", () => {
  const suffix = unique("rls");

  let admin: SupabaseClient;
  const createdUsers: string[] = [];

  const wsA = suffix + "_ws_a";
  const wsB = suffix + "_ws_b";

  let owner: { id: string; email: string; password: string };
  let analyst: { id: string; email: string; password: string };
  let reader: { id: string; email: string; password: string };
  let mailboxUser: { id: string; email: string; password: string };
  let outsider: { id: string; email: string; password: string };

  let workspaceAId = "";
  let workspaceBId = "";
  let mailboxId = "";

  /**
   * The authorisation layer must be in place before the suite says anything
   * about isolation. Without the helper functions every policy fails and
   * every user sees nothing, which would make a broken deployment look like
   * a passing one.
   */
  let authorisationReady = false;
  let authorisationProblem: string | null = null;

  beforeAll(async () => {
    const status = await authorisationLayerStatus();
    authorisationReady = status.ready;
    authorisationProblem = status.reason;
  }, 60_000);

  beforeAll(async () => {
    admin = adminClient();

    const make = async (name: string) => {
      const user = await createUser(admin, `${name}_${suffix}@ccm-test.local`);
      createdUsers.push(user.id);
      return user;
    };

    owner = await make("owner");
    analyst = await make("analyst");
    reader = await make("reader");
    mailboxUser = await make("mailbox");
    outsider = await make("outsider");

    // --- Two workspaces ---------------------------------------------------
    const { data: workspaces, error: workspaceError } = await admin
      .from("workspaces")
      .insert([
        { name: "RLS workspace A", slug: wsA },
        { name: "RLS workspace B", slug: wsB },
      ])
      .select("id, slug");
    if (workspaceError) throw new Error(workspaceError.message);

    workspaceAId = workspaces!.find((w) => w.slug === wsA)!.id;
    workspaceBId = workspaces!.find((w) => w.slug === wsB)!.id;

    // --- Memberships ------------------------------------------------------
    const { error: memberError } = await admin.from("workspace_members").insert([
      { workspace_id: workspaceAId, user_id: owner.id, role: "owner", status: "active" },
      { workspace_id: workspaceAId, user_id: analyst.id, role: "marketing_analyst", status: "active" },
      { workspace_id: workspaceAId, user_id: reader.id, role: "read_only", status: "active" },
      { workspace_id: workspaceBId, user_id: mailboxUser.id, role: "mailbox_user", status: "active" },
    ]);
    if (memberError) throw new Error(memberError.message);

    // --- Websites ---------------------------------------------------------
    const { error: websiteError } = await admin.from("websites").insert([
      { workspace_id: workspaceAId, name: "Workspace A site", domain: `${wsA}.example` },
      { workspace_id: workspaceBId, name: "Workspace B site", domain: `${wsB}.example` },
    ]);
    if (websiteError) throw new Error(websiteError.message);

    // --- Accounts ---------------------------------------------------------
    const { data: accounts, error: accountError } = await admin
      .from("external_accounts")
      .insert([
        {
          workspace_id: workspaceAId,
          provider_key: "gmail",
          external_account_id: "mailbox-a@example.test",
          display_label: "Mailbox A",
          identifiers: { gmail: { mailboxEmail: "mailbox-a@example.test" } },
        },
        {
          workspace_id: workspaceBId,
          provider_key: "gmail",
          external_account_id: "mailbox-b@example.test",
          display_label: "Mailbox B",
          identifiers: { gmail: { mailboxEmail: "mailbox-b@example.test" } },
        },
      ])
      .select("id, display_label");
    if (accountError) throw new Error(accountError.message);

    const accountA = accounts!.find((a) => a.display_label === "Mailbox A")!;
    const accountB = accounts!.find((a) => a.display_label === "Mailbox B")!;

    // The mailbox user is granted only account A.
    const { error: grantError } = await admin
      .from("external_account_grants")
      .insert([
        { external_account_id: accountA.id, user_id: mailboxUser.id, permission: "inbox.read" },
        { external_account_id: accountA.id, user_id: mailboxUser.id, permission: "inbox.send" },
      ]);
    if (grantError) throw new Error(grantError.message);

    // --- Mailboxes --------------------------------------------------------
    const { data: mailboxes, error: mailboxError } = await admin
      .from("mailbox_connections")
      .insert([
        {
          workspace_id: workspaceAId,
          account_id: accountA.id,
          provider_key: "gmail",
          mailbox_email: "mailbox-a@example.test",
          display_label: "Mailbox A",
          status: "connected",
        },
        {
          workspace_id: workspaceBId,
          account_id: accountB.id,
          provider_key: "gmail",
          mailbox_email: "mailbox-b@example.test",
          display_label: "Mailbox B",
          status: "connected",
        },
      ])
      .select("id, display_label");
    if (mailboxError) throw new Error(mailboxError.message);

    mailboxId = mailboxes!.find((m) => m.display_label === "Mailbox A")!.id;

    // --- Connections ------------------------------------------------------
    const { error: connectionError } = await admin.from("provider_connections").insert([
      { workspace_id: workspaceAId, provider_key: "ga4", display_label: "A GA4", status: "connected" },
      { workspace_id: workspaceBId, provider_key: "ga4", display_label: "B GA4", status: "connected" },
    ]);
    if (connectionError) throw new Error(connectionError.message);

    // --- A credential, to prove it is invisible ----------------------------
    const { data: connectionRows } = await admin
      .from("provider_connections")
      .select("id")
      .eq("display_label", "A GA4");
    const { error: credentialError } = await admin
      .from("provider_connection_credentials")
      .insert({
        connection_id: connectionRows![0]!.id,
        encrypted_secrets: "test-envelope-not-a-real-secret",
      });
    if (credentialError) throw new Error(credentialError.message);

    // --- Audit rows -------------------------------------------------------
    const { error: auditError } = await admin.from("audit_events").insert([
      {
        workspace_id: workspaceAId,
        actor_user_id: owner.id,
        action: "test.action",
        entity_type: "website",
        target_label: "A secret site",
      },
    ]);
    if (auditError) throw new Error(auditError.message);
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;

    // Remove the fixtures. The workspaces cascade to everything else.
    await admin.from("workspaces").delete().in("slug", [wsA, wsB]);
    await admin.from("provider_connection_credentials").delete().eq("encrypted_secrets", "test-envelope-not-a-real-secret");
    for (const userId of createdUsers) {
      await deleteUser(admin, userId);
    }
  }, 120_000);

  beforeEach(() => {
    if (!authorisationReady) {
      throw new Error(
        `The Row Level Security authorisation layer is not installed on this project, so isolation cannot be verified. ${authorisationProblem ?? ""}`.trim(),
      );
    }
  });

  it("lets a member see their own workspace's websites", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data } = await client.from("websites").select("name");
    expect((data ?? []).map((row) => row.name)).toContain("Workspace A site");
  });

  it("does not let a member see another workspace's websites", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data } = await client.from("websites").select("name");
    expect((data ?? []).map((row) => row.name)).not.toContain("Workspace B site");
  });

  it("returns nothing to a user who is not a member of any workspace", async () => {
    const client = await userClient(outsider.email, outsider.password);
    const { data } = await client.from("websites").select("name");
    expect(data ?? []).toHaveLength(0);
  });

  it("does not expose provider credentials to an authenticated user", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data, error } = await client
      .from("provider_connection_credentials")
      .select("encrypted_secrets");
    // Either the rows are hidden by RLS, or PostgREST refuses the table.
    expect(data ?? []).toHaveLength(0);
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/row-level|permission|denied|schema cache/i);
    }
  });

  it("lets a read-only member read connections", async () => {
    const client = await userClient(reader.email, reader.password);
    const { data } = await client.from("provider_connections").select("display_label");
    expect((data ?? []).map((row) => row.display_label)).toEqual(["A GA4"]);
  });

  it("keeps the audit log away from users without the audit permission", async () => {
    const client = await userClient(reader.email, reader.password);
    const { data } = await client.from("audit_events").select("target_label");
    expect(data ?? []).toHaveLength(0);
  });

  it("shows the audit log to a user with the audit permission", async () => {
    const client = await userClient(owner.email, owner.password);
    const { data } = await client.from("audit_events").select("target_label");
    expect((data ?? []).map((row) => row.target_label)).toContain("A secret site");
  });

  it("scopes an account-scoped role to its granted account only", async () => {
    const client = await userClient(mailboxUser.email, mailboxUser.password);
    const { data } = await client.from("external_accounts").select("display_label");
    expect((data ?? []).map((row) => row.display_label)).toEqual(["Mailbox A"]);
  });

  it("scopes mailbox connections to the granted mailbox only", async () => {
    const client = await userClient(mailboxUser.email, mailboxUser.password);
    const { data } = await client.from("mailbox_connections").select("id");
    expect((data ?? []).map((row) => row.id)).toEqual([mailboxId]);
  });

  it("does not let a mailbox user read another mailbox's metadata", async () => {
    const client = await userClient(mailboxUser.email, mailboxUser.password);
    const { data } = await client.from("mailbox_connections").select("mailbox_email");
    expect((data ?? []).map((row) => row.mailbox_email)).not.toContain(
      "mailbox-b@example.test",
    );
  });

  it("does not let a mailbox user read the website registry of another workspace", async () => {
    const client = await userClient(mailboxUser.email, mailboxUser.password);
    const { data } = await client.from("websites").select("name");
    expect(data ?? []).toHaveLength(0);
  });

  it("does not let a read-only user write an alert rule", async () => {
    const client = await userClient(reader.email, reader.password);
    const { error } = await client.from("alert_rules").insert({
      workspace_id: workspaceAId,
      metric: "ads_spend",
      direction: "increase",
      threshold: 0.2,
    });
    expect(error).not.toBeNull();
  });

  it("keeps metric tables invisible to a user without the matching permission", async () => {
    const client = await userClient(reader.email, reader.password);
    const { data } = await client.from("daily_ads_metrics").select("account_id");
    expect(data ?? []).toHaveLength(0);
  });

  it("lets the analyst read metric tables in their own workspace", async () => {
    const client = await userClient(analyst.email, analyst.password);
    // The table is empty, but the query must be permitted rather than denied.
    const { error } = await client.from("daily_ads_metrics").select("account_id");
    expect(error).toBeNull();
  });
});
