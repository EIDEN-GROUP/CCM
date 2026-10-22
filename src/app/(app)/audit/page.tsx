import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS, type Role } from "@/domain/permissions";
import { formatAge } from "@/domain/freshness";
import { getTranslator } from "@/lib/i18n-server";
import { formatMessage, type MessagePathRoot, type Translator } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** A message key inside the `pages.audit` namespace. */
type AuditPath = Extract<MessagePathRoot, `pages.audit.${string}`>;

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

const MEMBER_STATUS: Record<string, AuditPath> = {
  active: "pages.audit.statusActive",
  invited: "pages.audit.statusInvited",
  suspended: "pages.audit.statusSuspended",
};

const SEVERITY: Record<string, AuditPath> = {
  info: "pages.audit.severityInfo",
  warning: "pages.audit.severityWarning",
  critical: "pages.audit.severityCritical",
};

function labelFor(
  t: Translator,
  map: Record<string, AuditPath> | Record<string, RoleLabelPath>,
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
 * API does. Only the members Row Level Security already returned are
 * looked up, so nothing here widens what the reader may see.
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
  return { title: t("pages.audit.title") };
}

/**
 * Audit and security.
 *
 * The role and permission matrix, the members of the workspace, and the
 * append-only activity log.
 */
export default async function AuditPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "audit.read");
  if (!guard.allowed) return guard.response;

  const t = await getTranslator();

  const supabase = await createClient();
  const workspaceId = session.workspaceId!;

  const [{ data: members }, { data: events }, { data: roles }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("id, user_id, role, status, invited_at, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("audit_events")
      .select(
        "id, actor_user_id, action, entity_type, entity_id, target_label, severity, details, created_at",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("roles").select("key, label, account_scoped, description"),
  ]);

  const now = new Date();

  // The people behind the members and behind the recorded activity.
  const memberIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (member) => member.user_id,
  );
  const actorIds = ((events ?? []) as Array<{ actor_user_id: string | null }>)
    .map((event) => event.actor_user_id)
    .filter((id): id is string => Boolean(id));
  const emails = await resolveEmails([...memberIds, ...actorIds]);

  const leastPrivilegeBody = formatMessage(t("pages.audit.leastPrivilegeBody"), {
    mailboxUser: labelFor(t, ROLE_LABEL, "mailbox_user"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.audit.title")}
        subtitle={t("pages.audit.subtitle")}
      />

      <Notice tone="info" title={t("pages.audit.leastPrivilegeTitle")}>
        {leastPrivilegeBody}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.audit.membersTitle")}
          subtitle={t("pages.audit.membersSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.audit.membersTable")}
            rows={members ?? []}
            empty={
              <EmptyState
                title={t("pages.audit.noMembersTitle")}
                description={t("pages.audit.noMembersBody")}
                icon={<ShieldCheck className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => (row as { id: string }).id}
            columns={[
              {
                key: "user",
                header: t("pages.audit.columnUser"),
                mobile: "primary",
                render: (row) => {
                  const userId = (row as { user_id: string }).user_id;
                  return (
                    <span className="text-body-sm text-secondary">
                      {emails.get(userId) ?? t("common.unknown")}
                    </span>
                  );
                },
              },
              {
                key: "role",
                header: t("pages.audit.columnRole"),
                mobile: "secondary",
                render: (row) => {
                  const role = (row as { role: Role }).role;
                  const key = ROLE_LABEL[role];
                  return (
                    <Chip tone="teal">
                      {key ? t(key) : (ROLE_LABELS[role] ?? role)}
                    </Chip>
                  );
                },
              },
              {
                key: "status",
                header: t("common.status"),
                mobile: "secondary",
                render: (row) =>
                  labelFor(t, MEMBER_STATUS, (row as { status: string }).status),
              },
              {
                key: "invited",
                header: t("pages.audit.columnInvited"),
                mobile: "secondary",
                render: (row) => {
                  const value = (row as { invited_at: string | null }).invited_at;
                  return value
                    ? formatAge((now.getTime() - Date.parse(value)) / 1000)
                    : "—";
                },
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.audit.rolesAndPermissionsTitle")}
          subtitle={t("pages.audit.rolesAndPermissionsSubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.audit.rolesTable")}
            rows={roles ?? []}
            empty={
              <EmptyState
                title={t("pages.audit.noRolesTitle")}
                description={t("pages.audit.noRolesBody")}
                icon={<ShieldCheck className="size-5" />}
                className="border-0"
              />
            }
            rowKey={(row) => (row as { key: string }).key}
            columns={[
              {
                key: "role",
                header: t("pages.audit.columnRole"),
                mobile: "primary",
                render: (row) => {
                  const key = (row as { key: string }).key;
                  const labelKey = ROLE_LABEL[key];
                  const fallback = (row as { label: string }).label;
                  return (
                    <span className="font-semibold text-tertiary">
                      {labelKey ? t(labelKey) : fallback}
                    </span>
                  );
                },
              },
              {
                key: "scoped",
                header: t("pages.audit.columnAccountScoped"),
                mobile: "secondary",
                render: (row) =>
                  (row as { account_scoped: boolean }).account_scoped ? (
                    <Chip tone="warning">{t("pages.audit.perAccount")}</Chip>
                  ) : (
                    <Chip tone="neutral">{t("pages.audit.workspaceWide")}</Chip>
                  ),
              },
              {
                key: "description",
                header: t("pages.audit.columnDescription"),
                mobile: "secondary",
                render: (row) => (row as { description: string | null }).description ?? "—",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.audit.activity")}
          subtitle={t("pages.audit.activitySubtitle")}
        />
        <CardBody className="p-0">
          <DataTable
            label={t("pages.audit.activityTable")}
            rows={events ?? []}
            empty={
              <EmptyState
                title={t("pages.audit.noActivityTitle")}
                description={t("pages.audit.noActivityBody")}
                className="border-0"
              />
            }
            rowKey={(row) => (row as { id: string }).id}
            columns={[
              {
                key: "action",
                header: t("pages.audit.columnAction"),
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">
                    {(row as { action: string }).action}
                  </span>
                ),
              },
              {
                key: "actor",
                header: t("pages.audit.columnActor"),
                mobile: "secondary",
                render: (row) => {
                  const actorId = (row as { actor_user_id: string | null })
                    .actor_user_id;
                  return (
                    <span className="text-body-sm text-secondary">
                      {actorId
                        ? (emails.get(actorId) ?? t("common.unknown"))
                        : t("common.unknown")}
                    </span>
                  );
                },
              },
              {
                key: "entity",
                header: t("pages.audit.columnEntity"),
                mobile: "secondary",
                render: (row) => (row as { entity_type: string }).entity_type,
              },
              {
                key: "label",
                header: t("pages.audit.columnTarget"),
                mobile: "secondary",
                render: (row) =>
                  (row as { target_label: string | null }).target_label ?? "—",
              },
              {
                key: "severity",
                header: t("pages.audit.severity"),
                mobile: "secondary",
                render: (row) => {
                  const severity = (row as { severity: string }).severity;
                  return (
                    <Chip
                      tone={
                        severity === "critical"
                          ? "danger"
                          : severity === "warning"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {labelFor(t, SEVERITY, severity)}
                    </Chip>
                  );
                },
              },
              {
                key: "when",
                header: t("pages.audit.columnWhen"),
                mobile: "secondary",
                render: (row) => {
                  const value = (row as { created_at: string }).created_at;
                  return formatAge(
                    (now.getTime() - Date.parse(value)) / 1000,
                  );
                },
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
