import type { Metadata } from "next";
import { KeyRound, Settings, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS, type Role } from "@/domain/permissions";
import { formatAge } from "@/domain/freshness";
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage, type MessagePathRoot, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A message key inside the `pages.settings` namespace. */
type SettingsPath = Extract<MessagePathRoot, `pages.settings.${string}`>;

/** A message key inside the shared role-label vocabulary. */
type RoleLabelPath = Extract<MessagePathRoot, `pages.people.roleLabels.${string}`>;

/**
 * The role labels.
 *
 * The role *key* stays in English — it is what the database and the
 * permissions are keyed on — while the label a person reads is translated.
 */
const ROLE_LABEL: Record<string, RoleLabelPath> = {
  owner: "pages.people.roleLabels.owner",
  admin: "pages.people.roleLabels.admin",
  marketing_analyst: "pages.people.roleLabels.marketing_analyst",
  seo: "pages.people.roleLabels.seo",
  ads_manager: "pages.people.roleLabels.ads_manager",
  social_manager: "pages.people.roleLabels.social_manager",
  mailbox_user: "pages.people.roleLabels.mailbox_user",
  read_only: "pages.people.roleLabels.read_only",
};

const MEMBER_STATUS: Record<string, SettingsPath> = {
  active: "pages.settings.statusActive",
  invited: "pages.settings.statusInvited",
  suspended: "pages.settings.statusSuspended",
};

function labelFor(
  t: Translator,
  map: Record<string, SettingsPath> | Record<string, RoleLabelPath>,
  value: string,
): string {
  const key = map[value];
  return key ? t(key) : value;
}

/**
 * The email addresses of the people behind a set of user ids.
 *
 * A person is not a hexadecimal fragment, so the screens name them by
 * address. The address lives in the auth service, which PostgREST cannot
 * read, so the service-role client resolves it — the same way the members
 * API does. Only the rows Row Level Security already returned are looked
 * up, so nothing here widens what the reader may see.
 *
 * A failure is not fatal. The screen then says the person is unknown,
 * which is an honest answer, rather than falling back to an id.
 */
async function resolveEmails(userIds: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const wanted = [...new Set(userIds.filter(Boolean))];
  if (wanted.length === 0) return emails;

  try {
    const db = createAdminClient();

    // One page covers a workspace. Anything it does not carry is looked up
    // one by one.
    const { data } = await db.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const user of data?.users ?? []) {
      if (user.email) emails.set(user.id, user.email);
    }

    for (const id of wanted.filter((value) => !emails.has(value))) {
      const { data: found } = await db.auth.admin.getUserById(id);
      if (found?.user?.email) emails.set(id, found.user.email);
    }
  } catch {
    // The addresses stay unknown, and the screen says so.
  }

  return emails;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("pages.settings.title") };
}

/**
 * Workspace settings.
 *
 * The settings a medical-tourism marketing team actually needs to change:
 * who is in the workspace and with which role, which mailboxes each person
 * may read, how long data is kept, and what the audit log retains.
 */
export default async function SettingsPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "settings.manage");
  if (!guard.allowed) return guard.response;

  const t = await getTranslator();

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const [{ data: members }, { data: grants }, { data: preferences }] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("id, user_id, role, status, invited_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true }),
      supabase
        .from("external_account_grants")
        .select("external_account_id, user_id, permission, created_at"),
      supabase
        .from("user_preferences")
        .select("user_id, locale, timezone, currency, default_range, safe_mode")
        .eq("workspace_id", workspaceId),
    ]);

  const memberRows = (members ?? []) as Array<{
    id: string;
    user_id: string;
    role: string;
    status: string;
    invited_at: string | null;
  }>;

  const grantRows = (grants ?? []) as Array<{
    external_account_id: string;
    user_id: string;
    permission: string;
  }>;

  const { data: accounts } = await supabase
    .from("external_accounts")
    .select("id, display_label, provider_key")
    .eq("workspace_id", workspaceId);

  const accountRows = (accounts ?? []) as Array<{
    id: string;
    display_label: string;
    provider_key: string;
  }>;

  const now = new Date();

  // The people behind the members, the grants and the preferences.
  const emails = await resolveEmails([
    ...memberRows.map((member) => member.user_id),
    ...grantRows.map((grant) => grant.user_id),
    ...((preferences ?? []) as Array<{ user_id: string }>).map(
      (preference) => preference.user_id,
    ),
  ]);

  const retentionRows: Array<[string, string, string]> = [
    [
      t("pages.settings.retentionFactsLabel"),
      t("pages.settings.retentionFactsValue"),
      t("pages.settings.retentionFactsNote"),
    ],
    [
      t("pages.settings.retentionSyncLabel"),
      t("pages.settings.retentionSyncValue"),
      t("pages.settings.retentionSyncNote"),
    ],
    [
      t("pages.settings.retentionLaunchLabel"),
      t("pages.settings.retentionLaunchValue"),
      t("pages.settings.retentionLaunchNote"),
    ],
    [
      t("pages.settings.retentionAuditLabel"),
      t("pages.settings.retentionAuditValue"),
      t("pages.settings.retentionAuditNote"),
    ],
    [
      t("pages.settings.retentionMailboxLabel"),
      t("pages.settings.retentionMailboxValue"),
      t("pages.settings.retentionMailboxNote"),
    ],
    [
      t("pages.settings.retentionTicketLabel"),
      t("pages.settings.retentionTicketValue"),
      t("pages.settings.retentionTicketNote"),
    ],
    [
      t("pages.settings.retentionCredentialsLabel"),
      t("pages.settings.retentionCredentialsValue"),
      t("pages.settings.retentionCredentialsNote"),
    ],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.settings.title")}
        subtitle={t("pages.settings.subtitle")}
      />

      <Notice tone="info" title={t("pages.settings.leastPrivilegeTitle")}>
        {t("pages.settings.leastPrivilegeBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.settings.membersTitle")}
          subtitle={formatMessage(t("pages.settings.membersSubtitle"), {
            count: memberRows.length,
          })}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.settings.membersTable")}
            rows={memberRows}
            empty={
              <EmptyState
                title={t("pages.settings.noMembersTitle")}
                description={t("pages.settings.noMembersBody")}
                icon={<Users className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => row.id}
            columns={[
              {
                key: "user",
                header: t("pages.settings.columnUser"),
                mobile: "primary",
                render: (row) => (
                  <span className="text-body-sm text-secondary">
                    {emails.get(row.user_id) ?? t("common.unknown")}
                  </span>
                ),
              },
              {
                key: "role",
                header: t("pages.settings.columnRole"),
                mobile: "secondary",
                render: (row) => {
                  const role = row.role as Role;
                  const key = ROLE_LABEL[role];
                  return (
                    <Chip tone="teal">
                      {key ? t(key) : (ROLE_LABELS[role] ?? row.role)}
                    </Chip>
                  );
                },
              },
              {
                key: "status",
                header: t("common.status"),
                mobile: "secondary",
                render: (row) => (
                  <Chip
                    tone={
                      row.status === "active"
                        ? "success"
                        : row.status === "invited"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {labelFor(t, MEMBER_STATUS, row.status)}
                  </Chip>
                ),
              },
              {
                key: "invited",
                header: t("pages.settings.columnInvited"),
                mobile: "secondary",
                render: (row) =>
                  row.invited_at
                    ? formatAge((now.getTime() - Date.parse(row.invited_at)) / 1000)
                    : "—",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.settings.accountGrantsTitle")}
          subtitle={t("pages.settings.accountGrantsSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.settings.accountGrantsTable")}
            rows={grantRows}
            empty={
              <EmptyState
                title={t("pages.settings.noAccountGrantsTitle")}
                description={t("pages.settings.noAccountGrants")}
                icon={<KeyRound className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => `${row.external_account_id}:${row.user_id}:${row.permission}`}
            columns={[
              {
                key: "user",
                header: t("pages.settings.columnUser"),
                mobile: "primary",
                render: (row) => (
                  <span className="text-body-sm text-secondary">
                    {emails.get(row.user_id) ?? t("common.unknown")}
                  </span>
                ),
              },
              {
                key: "account",
                header: t("common.account"),
                mobile: "secondary",
                render: (row) =>
                  accountRows.find(
                    (account) => account.id === row.external_account_id,
                  )?.display_label ?? "—",
              },
              {
                key: "permission",
                header: t("pages.settings.columnPermission"),
                mobile: "secondary",
                render: (row) => row.permission,
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.settings.retentionTitle")}
          subtitle={t("pages.settings.retentionSubtitle")}
        />
        <CardBody>
          <dl className="divide-y divide-border/70 text-body-sm">
            {retentionRows.map(([label, value, note]) => (
              <div
                key={label}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2"
              >
                <dt className="font-semibold text-secondary">{label}</dt>
                <dd className="text-muted-text">
                  <span className="font-semibold text-tertiary">{value}</span> — {note}
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.settings.preferencesTitle")}
          subtitle={t("pages.settings.preferencesSubtitle")}
        />
        <CardBody>
          <DataTable
            label={t("pages.settings.preferencesTable")}
            rows={(preferences ?? []) as Array<Record<string, unknown>>}
            empty={
              <EmptyState
                title={t("pages.settings.noPreferencesTitle")}
                description={t("pages.settings.noPreferencesBody")}
                icon={<Settings className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => String(row.user_id)}
            columns={[
              {
                key: "user",
                header: t("pages.settings.columnUser"),
                mobile: "primary",
                render: (row) => (
                  <span className="text-body-sm text-secondary">
                    {emails.get(String(row.user_id)) ?? t("common.unknown")}
                  </span>
                ),
              },
              {
                key: "locale",
                header: t("pages.settings.columnLanguage"),
                mobile: "secondary",
                render: (row) => String(row.locale ?? "en"),
              },
              {
                key: "range",
                header: t("pages.settings.columnDefaultPeriod"),
                mobile: "secondary",
                render: (row) => String(row.default_range ?? "28d"),
              },
              {
                key: "safe",
                header: t("pages.settings.columnShareSafe"),
                mobile: "secondary",
                render: (row) =>
                  row.safe_mode
                    ? t("pages.settings.on")
                    : t("pages.settings.off"),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
