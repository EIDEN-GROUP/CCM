import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  authorisationLayerStatus,
  createUser,
  deleteUser,
  hasDatabase,
  unique,
  userClient,
  type TestUser,
} from "./harness";
import {
  deleteAppCredential,
  listAppCredentials,
  readAppCredential,
  writeAppCredential,
} from "@/lib/providers/app-credentials";

/**
 * The provider app credentials, against the live project.
 *
 * This is the table that lets the owner connect a provider from the
 * interface instead of from a redeploy, so its properties are worth
 * proving on the real database:
 *
 *   - the secret is encrypted at rest;
 *   - the secret is never returned by a listing;
 *   - only somebody who can manage the settings may read or change it;
 *   - a member of another workspace sees nothing.
 *
 * It writes fixture rows, so it refuses to run without the same explicit
 * opt-in as the RLS suite.
 */

/**
 * The table arrives with the repair. If it has not been applied yet, the
 * whole suite is skipped with a message rather than half-passing.
 */
async function providerAppsTableExists(): Promise<boolean> {
  if (!hasDatabase) return false;
  const admin = adminClient();
  const { error } = await admin
    .from("provider_app_credentials")
    .select("id")
    .limit(1);
  return !error;
}

const tableExists = await providerAppsTableExists();

const describeSuite = tableExists ? describe : describe.skip;

if (!tableExists && hasDatabase) {
  console.warn(
    "[provider-apps] The provider_app_credentials table is missing. Re-apply supabase/repair.sql to run this suite.",
  );
}

describeSuite("the provider app credentials, on the live project", () => {
  const suffix = unique("apps");
  const slug = `apps_${suffix}`;

  let admin: ReturnType<typeof adminClient>;
  let owner: TestUser;
  let reader: TestUser;
  let outsider: TestUser;
  let workspaceId: string;

  beforeAll(async () => {
    admin = adminClient();

    const layer = await authorisationLayerStatus();
    if (!layer.ready) {
      throw new Error(
        layer.reason ?? "The authorisation layer is not installed.",
      );
    }

    const make = async (name: string) => {
      const user = await createUser(admin, `${name}_${suffix}@ccm-test.local`);
      return user;
    };

    owner = await make("owner");
    reader = await make("reader");
    outsider = await make("outsider");

    const { data: workspaces, error: workspaceError } = await admin
      .from("workspaces")
      .insert([{ name: "Apps workspace", slug }])
      .select("id");
    if (workspaceError) throw new Error(workspaceError.message);
    workspaceId = workspaces![0]!.id;

    const { error: memberError } = await admin.from("workspace_members").insert([
      {
        workspace_id: workspaceId,
        user_id: owner.id,
        role: "owner",
        status: "active",
      },
      {
        workspace_id: workspaceId,
        user_id: reader.id,
        role: "read_only",
        status: "active",
      },
    ]);
    if (memberError) throw new Error(memberError.message);
  }, 120_000);

  afterAll(async () => {
    if (!admin) return;
    if (workspaceId) {
      await admin
        .from("provider_app_credentials")
        .delete()
        .eq("workspace_id", workspaceId);
      await admin.from("workspaces").delete().eq("id", workspaceId);
    }
    for (const user of [owner, reader, outsider]) {
      if (user?.id) await deleteUser(admin, user.id);
    }
  }, 60_000);


  it("stores an encrypted secret and reads it back", async () => {

    await writeAppCredential(admin, {
      workspaceId,
      providerKey: "meta",
      clientId: `app-${suffix}`,
      secret: `secret-${suffix}`,
      redirectUri: "https://ccm.example/api/auth/meta/callback",
    });

    const stored = await readAppCredential(admin, workspaceId, "meta");

    expect(stored?.clientId).toBe(`app-${suffix}`);
    expect(stored?.secret).toBe(`secret-${suffix}`);

    // The row on disk does not contain the secret in clear.
    const { data: raw } = await admin
      .from("provider_app_credentials")
      .select("encrypted_secret")
      .eq("workspace_id", workspaceId)
      .eq("provider_key", "meta")
      .single();

    expect(raw?.encrypted_secret).toBeTruthy();
    expect(raw?.encrypted_secret).not.toContain(`secret-${suffix}`);
  });

  it("never returns a secret in a listing", async () => {

    const listed = await listAppCredentials(admin, workspaceId);

    expect(listed.length).toBeGreaterThan(0);
    expect(listed[0]?.hasSecret).toBe(true);
    expect(JSON.stringify(listed)).not.toContain(`secret-${suffix}`);
  });

  it("hides the credential from a member without the settings permission", async () => {

    const client = await userClient(reader.email, reader.password);

    const { data, error } = await client
      .from("provider_app_credentials")
      .select("id, client_id, encrypted_secret");

    // The read-only role has no settings permission, so the policy returns
    // nothing — not an error, and not the secret.
    if (error) {
      expect(error.message).toMatch(/permission denied|row-level security/i);
    } else {
      expect(data ?? []).toHaveLength(0);
    }
  });

  it("hides the credential from a member of another workspace", async () => {

    const client = await userClient(outsider.email, outsider.password);

    const { data } = await client
      .from("provider_app_credentials")
      .select("id, client_id");

    expect(data ?? []).toHaveLength(0);
  });

  it("removes the credential", async () => {

    await deleteAppCredential(admin, workspaceId, "meta");

    expect(await readAppCredential(admin, workspaceId, "meta")).toBeNull();
  });
});
