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
import { intlLocale, type Translator } from "@/lib/i18n";
import { getLocale, getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("nav.unifiedInbox") };
}

/**
 * The mailbox status, in words.
 *
 * The catalogue covers the statuses a mailbox connection can hold; anything
 * else keeps its raw value rather than an invented label.
 */
function statusLabel(status: string, t: Translator): string {
  switch (status) {
    case "connected":
      return t("api.connected");
    case "needs_setup":
      return t("api.needsSetup");
    case "token_refresh_failed":
      return t("api.tokenRefreshFailed");
    case "permission_revoked":
      return t("api.permissionRevoked");
    case "provider_outage":
      return t("api.providerOutage");
    case "rate_limited":
      return t("api.rateLimited");
    case "sync_stale":
      return t("api.syncStale");
    case "not_configured":
      return t("api.notConfigured");
    default:
      return status.replace(/_/g, " ");
  }
}

/**
 * Relative age, in the interface language.
 *
 * The shared domain formatter speaks English only, and a half-translated
 * screen is worse than an untranslated one.
 */
function formatAgeLabel(ageSeconds: number, locale: string): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
  if (ageSeconds < 60) {
    return relative.format(-Math.max(1, Math.round(ageSeconds)), "second");
  }
  const minutes = ageSeconds / 60;
  if (minutes < 60) return relative.format(-Math.round(minutes), "minute");
  const hours = minutes / 60;
  if (hours < 24) return relative.format(-Math.round(hours), "hour");
  return relative.format(-Math.round(hours / 24), "day");
}

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
  const t = await getTranslator();
  const locale = intlLocale(await getLocale());

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
        title={t("pages.inbox.title")}
        subtitle={t("pages.inbox.subtitle")}
      />

      <Notice tone="info" title={t("pages.inbox.mailboxPrivacyNoticeTitle")}>
        {t("pages.inbox.mailboxPrivacyNoticeBody")}
      </Notice>

      <Card>
        <CardHeader
          title={t("pages.inbox.mailboxesCardTitle")}
          subtitle={t("pages.inbox.mailboxesCardSubtitle")}
        />
        <CardBody className="p-0">
            <DataTable
              label={t("pages.inbox.mailboxesTableLabel")}
              rows={rows}
              empty={
                <EmptyState
                  title={t("pages.inbox.noMailboxTitle")}
                  description={t("pages.inbox.noMailboxDescription")}
                  icon={<Mail className="size-5" />}
                  className="border-0"
                />
              }
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "label",
                  header: t("pages.inbox.mailbox"),
                  mobile: "primary",
                  render: (row) => (
                    <span className="font-semibold text-tertiary">
                      {row.display_label}
                    </span>
                  ),
                },
                {
                  key: "email",
                  header: t("pages.inbox.addressColumn"),
                  mobile: "secondary",
                  render: (row) => row.mailbox_email,
                },
                {
                  key: "status",
                  header: t("common.status"),
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
                      {statusLabel(row.status, t)}
                    </Chip>
                  ),
                },
                {
                  key: "ai",
                  header: t("pages.inbox.aiProcessingColumn"),
                  mobile: "secondary",
                  render: (row) =>
                    row.ai_processing_enabled ? (
                      <Chip tone="warning">{t("pages.inbox.enabled")}</Chip>
                    ) : (
                      <Chip tone="neutral">{t("pages.inbox.off")}</Chip>
                    ),
                },
                {
                  key: "sync",
                  header: t("common.lastSync"),
                  mobile: "secondary",
                  render: (row) =>
                    row.last_sync_at
                      ? formatAgeLabel(
                          (now.getTime() - Date.parse(row.last_sync_at)) / 1000,
                          locale,
                        )
                      : "—",
                },
              ]}
            />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("pages.inbox.messagesCardTitle")}
          subtitle={t("pages.inbox.messagesCardSubtitle")}
        />
        <CardBody>
          {connected.length === 0 ? (
            <EmptyState
              title={t("pages.inbox.noConnectedMailboxTitle")}
              description={t("pages.inbox.noConnectedMailboxDescription")}
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
