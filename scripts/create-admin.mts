/**
 * Create the administrator account.
 *
 * The product is invite-only, so an account is not created by signing up:
 * it is created here, confirmed, and then attached to a workspace with a
 * role. This script does all three, and it is the only supported way to
 * make the first person.
 *
 *   npx tsx scripts/create-admin.mts --email admin@medicalbay.ma
 *
 * It also creates the workspace if there is none, because an account with
 * no workspace can see nothing — the authorisation helpers resolve a
 * workspace through the membership.
 *
 * The password is generated with a cryptographic RNG and printed **once**.
 * It is never written to a file, never logged, and never sent anywhere.
 * Pass `--password` to choose your own.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/** Load `.env` (or `.env.local`) without adding a dependency. */
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

/** The arguments. */
function parseArgs(): {
  email: string | null;
  password: string | null;
  reset: boolean;
  workspaceName: string;
  workspaceSlug: string;
  role: string;
} {
  const args = process.argv.slice(2);

  const valueAfter = (flag: string): string | null => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };

  return {
    email: valueAfter("--email"),
    password: valueAfter("--password"),
    reset: args.includes("--reset-password"),
    workspaceName: valueAfter("--workspace") ?? "Medical Bay",
    workspaceSlug: valueAfter("--slug") ?? "medical-bay",
    role: valueAfter("--role") ?? "owner",
  };
}

/**
 * A strong password.
 *
 * A cryptographic RNG, and an alphabet without the characters that are easy
 * to confuse when it is copied off a screen.
 */
function generatePassword(): string {
  const alphabet =
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const size = 20;

  const bytes = randomBytes(size);
  let password = "";
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }

  // One of each class, so the password satisfies the usual complexity
  // rules without the owner having to add a symbol that gets mistyped.
  return (
    password.slice(0, 4) +
    "aZ" +
    password.slice(6, 12) +
    "7" +
    password.slice(13)
  );
}

async function main() {
  const args = parseArgs();
  const env = loadEnv();

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
    );
    process.exit(1);
  }

  if (!args.email) {
    console.error("An email is required: --email you@medicalbay.ma");
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = args.password ?? generatePassword();
  const generated = !args.password;

  // --- The user ------------------------------------------------------------
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: args.email,
      password,
      email_confirm: true,
      // The account is invite-only, so it is created without a sign-up.
    });

  let userId = created?.user?.id;
  let userExists = false;

  if (createError) {
    const alreadyThere = /already|registered|exists/i.test(createError.message);

    if (!alreadyThere) {
      console.error(`Could not create the account: ${createError.message}`);
      process.exit(1);
    }

    // The account is already there. Find it, and reset its password only
    // when the owner asked for that.
    userExists = true;

    const { data: list, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (listError) {
      console.error(`Could not list the accounts: ${listError.message}`);
      process.exit(1);
    }

    const found = list.users.find(
      (user) => user.email?.toLowerCase() === args.email!.toLowerCase(),
    );

    if (!found) {
      console.error(
        `The account ${args.email} already exists but could not be found.`,
      );
      process.exit(1);
    }

    userId = found.id;

    if (!args.reset) {
      console.error(
        `The account ${args.email} already exists. Pass --reset-password to set a new password for it.`,
      );
      process.exit(1);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(
      userId,
      { password },
    );

    if (updateError) {
      console.error(`Could not reset the password: ${updateError.message}`);
      process.exit(1);
    }
  }

  // --- The workspace -------------------------------------------------------
  const { data: existingWorkspaces } = await admin
    .from("workspaces")
    .select("id, name, slug")
    .eq("slug", args.workspaceSlug)
    .maybeSingle();

  let workspaceId = existingWorkspaces?.id ?? null;

  if (!workspaceId) {
    const { data: createdWorkspace, error: workspaceError } = await admin
      .from("workspaces")
      .insert({
        name: args.workspaceName,
        slug: args.workspaceSlug,
        timezone: "Africa/Casablanca",
        currency: "MAD",
      })
      .select("id, name, slug")
      .single();

    if (workspaceError) {
      console.error(
        `Could not create the workspace: ${workspaceError.message}`,
      );
      process.exit(1);
    }

    workspaceId = createdWorkspace!.id;
    console.log(`workspace created: ${createdWorkspace!.name}`);
  } else {
    console.log(`workspace found: ${existingWorkspaces!.name}`);
  }

  // --- The membership ------------------------------------------------------
  const { data: existingMember } = await admin
    .from("workspace_members")
    .select("id, role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    const { error: updateError } = await admin
      .from("workspace_members")
      .update({ role: args.role, status: "active" })
      .eq("id", existingMember.id);

    if (updateError) {
      console.error(
        `Could not update the membership: ${updateError.message}`,
      );
      process.exit(1);
    }

    console.log(`membership updated: role ${args.role}, active`);
  } else {
    const { error: memberError } = await admin
      .from("workspace_members")
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: args.role,
        status: "active",
      });

    if (memberError) {
      console.error(
        `Could not add the membership: ${memberError.message}`,
      );
      process.exit(1);
    }

    console.log(`membership created: role ${args.role}, active`);
  }

  // --- The audit trail -----------------------------------------------------
  await admin.from("audit_events").insert({
    workspace_id: workspaceId,
    actor_user_id: userId,
    action: userExists
      ? "workspace.admin_password_reset"
      : "workspace.admin_created",
    entity_type: "workspace_member",
    entity_id: userId,
    target_label: args.email,
    severity: "critical",
    details: { role: args.role, source: "scripts/create-admin.mts" },
  });

  // --- The credentials -----------------------------------------------------
  // Printed once. Not written anywhere, not logged.
  console.log("");
  console.log("─".repeat(64));
  console.log(`  email     ${args.email}`);
  console.log(`  password  ${password}`);
  console.log("─".repeat(64));
  console.log(
    generated
      ? "  This password is shown once. Save it now, then change it."
      : "  The password you supplied was used.",
  );
  console.log("");
  console.log(`  Sign in at /login with ${args.email}.`);
  console.log("");

  process.exit(0);
}

main();
