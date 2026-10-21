import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";
import { MailboxBrowser } from "@/components/inbox/mailbox-browser";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { formatAge } from "@/domain/freshness";

export const metadata: Metadata = { title: "Unified Inbox" };
export const dynamic = "force-dynamic";

/**
 * The unified mailbox.
 *
 * The medicalbay.ma domain is hosted on Google Workspace (the MX record
 * points at SMTP.GOOGLE.COM), so the Gmail API covers every Medical Bay
 * mailbox — there is no IMAP fallback to design for.
 *
 * The screen has two parts. The top shows the mailboxes this person is
 * authorised to read and their sync state. Below it, the mailbox browser
 * searches, pages and reads through the provider.
 */
export default async function InboxPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "inbox.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();

  const { data: mailboxes } = await supabase
    .from("mailbox_connections")
    .select(
      "id, workspace_id, account_id, provider_key, mailbox_email, display_label, auth_method, status, scopes, ai_processing_enabled, last_sync_at, last_error",
    )
    .eq("workspace_id", session.workspaceId!)
    .order("display_label", { ascending: true });

  const rows = (mailboxes ?? []) as Array<{
    id: string;
    mailbox_email: string;
    display_label: string;
    provider_key: string;
    auth_method: string;
    status: string;
    scopes: string[];
    ai_processing_enabled: boolean;
    last_sync_at: string | null;
    last_error: string | null;
  }>;

  const connected = rows.filter(
    (row) => row.status === "connected" && row.provider_key === "gmail",
  );

  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unified Email"
        subtitle="Authorised mailboxes, threads and follow-ups."
      />

      <Notice tone="info" title="Mailbox privacy">
        Mailbox content is isolated from the rest of CCM and is protected by
        its own permission set and row-level policies. Message bodies and
        attachments are read from the provider when you open a message and
        are never stored here. AI summarisation is opt-in per mailbox — it is
        off until someone explicitly enables it. Sending always takes a
        confirmation that shows the recipient and the sending identity, and
        every send is recorded in the audit log.
      </Notice>

      <Card>
        <CardHeader
          title="Mailboxes"
          subtitle="Every account you are authorised to read"
        />
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              title="No mailbox connected"
              description="medicalbay.ma runs on Google Workspace. Connect a mailbox with the Gmail API to bring the inbox into CCM."
              icon={<Mail className="size-5" />}
              className="border-0"
            />
          ) : (
            <DataTable
              label="Mailboxes"
              rows={rows}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "label",
                  header: "Mailbox",
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {row.display_label}
                    </span>
                  ),
                },
                {
                  key: "email",
                  header: "Address",
                  mobile: "secondary",
                  render: (row) => row.mailbox_email,
                },
                {
                  key: "status",
                  header: "Status",
                  mobile: "secondary",
                  render: (row) => (
                    <Chip
                      tone={
                        row.status === "connected"
                          ? "success"
                          : row.status === "needs_setup"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {row.status.replace(/_/g, " ")}
                    </Chip>
                  ),
                },
                {
                  key: "ai",
                  header: "AI processing",
                  mobile: "hidden",
                  render: (row) =>
                    row.ai_processing_enabled ? (
                      <Chip tone="warning">Enabled</Chip>
                    ) : (
                      <Chip tone="neutral">Off</Chip>
                    ),
                },
                {
                  key: "sync",
                  header: "Last sync",
                  mobile: "secondary",
                  render: (row) =>
                    row.last_sync_at
                      ? formatAge(
                          (now.getTime() - Date.parse(row.last_sync_at)) / 1000,
                        )
                      : "—",
                },
              ]}
            />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Messages"
          subtitle="Search, page and read. Bodies are fetched on demand and never stored."
        />
        <CardBody>
          {connected.length === 0 ? (
            <EmptyState
              title="No connected mailbox to read"
              description="The mailbox browser opens once a Gmail mailbox is connected. The list above shows what is connected and what still needs setup."
              icon={<Mail className="size-5" />}
              className="border-0"
            />
          ) : (
            <MailboxBrowser
              mailboxes={connected.map((mailbox) => ({
                id: mailbox.id,
                email: mailbox.mailbox_email,
                displayLabel: mailbox.display_label,
                status: mailbox.status,
              }))}
              canSend={session.permissions.has("inbox.send")}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
