import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS, type Role } from "@/domain/permissions";
import { formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="People, permissions, data retention and the audit log."
      />

      <Notice tone="info" title="Least privilege by default">
        A role grants feature-level permissions across the workspace. A
        mailbox user additionally needs an explicit grant on the individual
        mailbox, so one person can read one mailbox without seeing the rest.
      </Notice>

      <Card>
        <CardHeader
          title="Members"
          subtitle={`${memberRows.length} in this workspace`}
        />
        <CardBody className="p-0">
          <DataTable
            label="Workspace members"
            rows={memberRows}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "user",
                header: "User",
                mobile: "primary",
                render: (row) => (
                  <span className="font-mono text-body-sm text-secondary">
                    {row.user_id.slice(0, 8)}…
                  </span>
                ),
              },
              {
                key: "role",
                header: "Role",
                mobile: "secondary",
                render: (row) => (
                  <Chip tone="teal">
                    {ROLE_LABELS[row.role as Role] ?? row.role}
                  </Chip>
                ),
              },
              {
                key: "status",
                header: "Status",
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
                    {row.status}
                  </Chip>
                ),
              },
              {
                key: "invited",
                header: "Invited",
                mobile: "hidden",
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
          title="Account grants"
          subtitle="Who may read which individual account"
        />
        <CardBody className="p-0">
          {grantRows.length === 0 ? (
            <p className="px-4 py-6 text-body-sm text-muted-text">
              No account grants. Members with workspace-wide roles do not need
              one.
            </p>
          ) : (
            <DataTable
              label="Account grants"
              rows={grantRows}
              rowKey={(row) => `${row.external_account_id}:${row.user_id}:${row.permission}`}
              columns={[
                {
                  key: "user",
                  header: "User",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-mono text-body-sm text-secondary">
                      {row.user_id.slice(0, 8)}…
                    </span>
                  ),
                },
                {
                  key: "account",
                  header: "Account",
                  mobile: "secondary",
                  render: (row) =>
                    accountRows.find(
                      (account) => account.id === row.external_account_id,
                    )?.display_label ?? "—",
                },
                {
                  key: "permission",
                  header: "Permission",
                  mobile: "secondary",
                  render: (row) => row.permission,
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Data retention"
          subtitle="How long each kind of record is kept"
        />
        <CardBody>
          <dl className="divide-y divide-border/70 text-body-sm">
            {[
              ["Daily metric facts", "25 months", "Set in the retention settings."],
              ["Sync runs and errors", "90 days", "Pruned by the retention job."],
              ["Launch events", "12 months", "Evidence of account launches."],
              ["Audit events", "24 months", "A compliance decision — review before shortening."],
              ["Mailbox metadata", "12 months", "Per mailbox. Bodies and attachments are never stored."],
              ["Launch tickets", "60 seconds", "Fixed by design: a ticket is a momentary permission."],
              ["Provider credentials", "Until disconnect", "Deleted when the account is disconnected."],
            ].map(([label, value, note]) => (
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
          title="Your preferences"
          subtitle="Interface language, timezone and export masking"
        />
        <CardBody>
          <DataTable
            label="Preferences"
            rows={(preferences ?? []) as Array<Record<string, unknown>>}
            rowKey={(row) => String(row.user_id)}
            columns={[
              {
                key: "user",
                header: "User",
                mobile: "primary",
                render: (row) => (
                  <span className="font-mono text-body-sm text-secondary">
                    {String(row.user_id).slice(0, 8)}…
                  </span>
                ),
              },
              {
                key: "locale",
                header: "Language",
                mobile: "secondary",
                render: (row) => String(row.locale ?? "en"),
              },
              {
                key: "range",
                header: "Default period",
                mobile: "secondary",
                render: (row) => String(row.default_range ?? "28d"),
              },
              {
                key: "safe",
                header: "Share safe",
                mobile: "hidden",
                render: (row) => (row.safe_mode ? "On" : "Off"),
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
