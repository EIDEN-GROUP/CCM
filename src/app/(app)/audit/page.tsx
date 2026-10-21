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
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS, type Role } from "@/domain/permissions";
import { formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Audit & Security" };
export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & Security"
        subtitle="Roles, permissions, retention and activity."
      />

      <Notice tone="info" title="Least privilege by default">
        Access is granted by role at workspace level and, where a role is
        account-scoped such as Mailbox User, by an explicit grant on a single
        account. Row Level Security enforces this in the database, so a hidden
        navigation item is a convenience rather than the control.
      </Notice>

      <Card>
        <CardHeader
          title="Members"
          subtitle="Everyone with access to this workspace"
        />
        <CardBody className="p-0">
          {(members ?? []).length === 0 ? (
            <EmptyState
              title="No members"
              description="Members appear here once they are invited."
              icon={<ShieldCheck className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Workspace members"
              rows={members ?? []}
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "user",
                  header: "User",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-mono text-body-sm text-secondary">
                      {(row as { user_id: string }).user_id.slice(0, 8)}…
                    </span>
                  ),
                },
                {
                  key: "role",
                  header: "Role",
                  mobile: "secondary",
                  render: (row) => {
                    const role = (row as { role: Role }).role;
                    return (
                      <Chip tone="teal">
                        {ROLE_LABELS[role] ?? role}
                      </Chip>
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  mobile: "secondary",
                  render: (row) => (row as { status: string }).status,
                },
                {
                  key: "invited",
                  header: "Invited",
                  mobile: "hidden",
                  render: (row) => {
                    const value = (row as { invited_at: string | null }).invited_at;
                    return value
                      ? formatAge((now.getTime() - Date.parse(value)) / 1000)
                      : "—";
                  },
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Roles & permissions"
          subtitle="The matrix the database enforces"
        />
        <CardBody className="p-0">
          <DataTable
            label="Roles"
            rows={roles ?? []}
            rowKey={(row) => (row as { key: string }).key}
            columns={[
              {
                key: "role",
                header: "Role",
                mobile: "primary",
                render: (row) => (
                  <span className="font-semibold text-tertiary">
                    {(row as { label: string }).label}
                  </span>
                ),
              },
              {
                key: "scoped",
                header: "Account scoped",
                mobile: "secondary",
                render: (row) =>
                  (row as { account_scoped: boolean }).account_scoped ? (
                    <Chip tone="warning">Per account</Chip>
                  ) : (
                    <Chip tone="neutral">Workspace wide</Chip>
                  ),
                },
              {
                key: "description",
                header: "Description",
                mobile: "hidden",
                render: (row) => (row as { description: string | null }).description ?? "—",
              },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Activity log"
          subtitle="Append-only record of sensitive actions"
        />
        <CardBody className="p-0">
          {(events ?? []).length === 0 ? (
            <EmptyState
              title="No activity recorded yet"
              description="Launches, connection changes and permission changes are recorded here."
              className="border-0"
            />
          ) : (
            <DataTable
              label="Audit events"
              rows={events ?? []}
              rowKey={(row) => (row as { id: string }).id}
              columns={[
                {
                  key: "action",
                  header: "Action",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {(row as { action: string }).action}
                    </span>
                  ),
                },
                {
                  key: "entity",
                  header: "Entity",
                  mobile: "secondary",
                  render: (row) => (row as { entity_type: string }).entity_type,
                },
                {
                  key: "label",
                  header: "Target",
                  mobile: "hidden",
                  render: (row) =>
                    (row as { target_label: string | null }).target_label ?? "—",
                },
                {
                  key: "severity",
                  header: "Severity",
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
                        {severity}
                      </Chip>
                    );
                  },
                },
                {
                  key: "when",
                  header: "When",
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
          )}
        </CardBody>
      </Card>
    </div>
  );
}
