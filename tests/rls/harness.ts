import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test harness for the Row Level Security suite.
 *
 * The suite runs against a real Supabase project through the real request
 * path — PostgREST, with a genuine session token per user. That is
 * stronger than a raw SQL session, because it exercises exactly the request
 * shape an attacker would use.
 *
 * Setup writes fixture rows through the service-role client (which bypasses
 * RLS); every assertion is then made through a per-user client holding that
 * user's real access token, so the policies under test are the live ones.
 *
 * The suite writes to the database, so it refuses to run without an explicit
 * opt-in: `CCM_RLS_ALLOW_WRITE=1`.
 */

/** Load `.env` (or `.env.local`) without adding a dependency. */
export function loadEnv(): Record<string, string> {
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

  return values;
}

const ENV = { ...loadEnv(), ...process.env };

export const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** The suite writes fixture rows, so it needs an explicit opt-in. */
export const RLS_WRITE_CONSENT = ENV.CCM_RLS_ALLOW_WRITE === "1";

export function skipReason(): string | null {
  if (!SUPABASE_URL) return "NEXT_PUBLIC_SUPABASE_URL is not set";
  if (!ANON_KEY) return "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set";
  if (!SERVICE_ROLE_KEY) return "SUPABASE_SERVICE_ROLE_KEY is not set";
  if (!RLS_WRITE_CONSENT) return "CCM_RLS_ALLOW_WRITE is not set to 1";
  return null;
}

export const hasDatabase = skipReason() === null;

/** A client that bypasses RLS. Setup only. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** A client that speaks as a specific signed-in user. */
export async function userClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Could not sign in ${email}: ${error.message}`);
  }
  return client;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Create a confirmed user through the admin API. */
export async function createUser(
  admin: SupabaseClient,
  email: string,
): Promise<TestUser> {
  const password = `ccm-test-${Math.random().toString(36).slice(2, 14)}!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Could not create ${email}: ${error.message}`);
  }

  return { id: data.user!.id, email, password };
}

/** Remove a user through the admin API. */
export async function deleteUser(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  await admin.auth.admin.deleteUser(userId);
}

/** Random-ish suffix so parallel runs do not collide. */
export function unique(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Check that the Row Level Security authorisation layer is installed.
 *
 * The helper functions are the foundation of every policy. If they are
 * missing — because a migration aborted, or because PostgREST's schema cache
 * has not been reloaded — every policy that calls them fails, and every
 * authenticated user sees nothing. Detecting that up front turns a wall of
 * confusing assertion failures into one actionable instruction.
 */
export async function authorisationLayerStatus(): Promise<{
  ready: boolean;
  reason: string | null;
}> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/has_permission`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_workspace: "00000000-0000-0000-0000-000000000000",
        perm: "overview.read",
      }),
    },
  );

  if (response.status === 404) {
    return {
      ready: false,
      reason:
        "The RLS helper functions are not visible to PostgREST. Either they were never created (a migration aborted) or the schema cache has not been reloaded. Apply supabase/repair.sql — it ends with `notify pgrst, 'reload schema'`.",
    };
  }

  if (response.status >= 500) {
    return {
      ready: false,
      reason: `The authorisation check returned ${response.status}.`,
    };
  }

  return { ready: true, reason: null };
}
