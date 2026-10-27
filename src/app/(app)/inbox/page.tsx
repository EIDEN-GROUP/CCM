import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { MailboxBrowser } from "@/components/inbox/mailbox-browser";
import { CustomMailSetup } from "@/components/inbox/custom-mail-setup";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTranslator } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return { title: t("nav.unifiedInbox") };
}

/** A familiar mail workspace with separate Gmail and custom-domain inboxes. */
export default async function InboxPage() {
  const session = await getSession();
  const guard = await requirePermission(session, "inbox.read");
  if (!guard.allowed) return guard.response;

  const supabase = await createClient();
  const t = await getTranslator();
  const { data: mailboxes } = await supabase
    .from("mailbox_connections")
    .select("id, mailbox_email, display_label, provider_key, auth_method, status")
    .eq("workspace_id", session.workspaceId!)
    .order("display_label", { ascending: true });

  const connected = (mailboxes ?? []).filter(
    (mailbox) => mailbox.status === "connected" && mailbox.provider_key === "gmail",
  );

  return (
    <div className="dashboard-page-enter space-y-5">
      <PageHeader
        title={t("pages.inbox.title")}
        subtitle={t("pages.inbox.subtitle")}
      />

      <CustomMailSetup canManage={session.permissions.has("integrations.manage")} />

      <details className="group rounded-lg border border-border bg-pale/55 px-4 py-3">
        <summary className="cursor-pointer text-label-md font-semibold text-primary-ink marker:text-primary-ink">
          {t("pages.inbox.mailboxPrivacyNoticeTitle")}
        </summary>
        <p className="mt-2 max-w-5xl text-body-sm text-secondary">
          {t("pages.inbox.mailboxPrivacyNoticeBody")}
        </p>
      </details>

      <Card className="overflow-hidden border-border/80">
        <CardHeader
          title={t("pages.inbox.messagesCardTitle")}
          subtitle={t("pages.inbox.messagesCardSubtitle")}
        />
        <CardBody>
          {connected.length === 0 ? (
            <EmptyState
              title={t("pages.inbox.noConnectedMailboxTitle")}
              description={t("pages.inbox.noConnectedMailboxDescription")}
              icon={<Mail aria-hidden="true" className="size-5" />}
              className="border-0"
            />
          ) : (
            <MailboxBrowser
              mailboxes={connected.map((mailbox) => ({
                id: mailbox.id,
                email: mailbox.mailbox_email,
                displayLabel: mailbox.display_label,
                status: mailbox.status,
                source: mailbox.auth_method === "imap" ? "custom" : "gmail",
              }))}
              canSend={session.permissions.has("inbox.send")}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
