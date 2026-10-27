"use client";

import { useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/providers/i18n-provider";

export function CustomMailSetup({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManage) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const value = (name: string) => String(formData.get(name) ?? "").trim();
    const secret = (name: string) => String(formData.get(name) ?? "");
    try {
      const response = await fetch("/api/mailbox/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: value("email"), displayLabel: value("displayLabel"),
          imapHost: value("imapHost"), imapPort: Number(value("imapPort")),
          imapUsername: value("imapUsername"), imapPassword: secret("imapPassword"),
          smtpHost: value("smtpHost"), smtpPort: Number(value("smtpPort")),
          smtpUsername: value("smtpUsername"), smtpPassword: secret("smtpPassword"),
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? t("pages.inbox.customSetupFailed"));
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pages.inbox.customSetupFailed"));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-headline-sm font-semibold text-tertiary">{t("pages.inbox.addCustomMailbox")}</h2>
          <p className="mt-1 text-body-sm text-muted-text">{t("pages.inbox.customMailboxHelp")}</p>
        </div>
        <Button size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? <X aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
          {open ? t("common.close") : t("pages.inbox.addCustomMailbox")}
        </Button>
      </div>
      {open ? (
        <form action={(data) => void submit(data)} className="mt-4 space-y-4 border-t border-border pt-4">
          <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-2 font-semibold text-secondary">{t("pages.inbox.mailboxDetails")}</legend>
            <Field label={t("pages.inbox.emailAddress")} name="email" type="email" required placeholder="you@yourdomain.com" />
            <Field label={t("pages.inbox.mailboxName")} name="displayLabel" required placeholder="Work mailbox" />
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-2 font-semibold text-secondary">{t("pages.inbox.receiveSettings")}</legend>
            <Field label={t("pages.inbox.imapServer")} name="imapHost" required placeholder="mail.yourdomain.com" />
            <Field label={t("pages.inbox.serverPort")} name="imapPort" type="number" defaultValue="993" required />
            <Field label={t("pages.inbox.username")} name="imapUsername" required />
            <Field label={t("pages.inbox.password")} name="imapPassword" type="password" required autoComplete="new-password" />
          </fieldset>
          <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <legend className="mb-2 font-semibold text-secondary">{t("pages.inbox.sendSettings")}</legend>
            <Field label={t("pages.inbox.smtpServer")} name="smtpHost" required placeholder="mail.yourdomain.com" />
            <Field label={t("pages.inbox.serverPort")} name="smtpPort" type="number" defaultValue="465" required />
            <Field label={t("pages.inbox.username")} name="smtpUsername" required />
            <Field label={t("pages.inbox.password")} name="smtpPassword" type="password" required autoComplete="new-password" />
          </fieldset>
          {error ? <p role="alert" className="rounded-md border border-error/30 bg-error-surface px-3 py-2 text-body-sm text-error-ink">{error}</p> : null}
          <p className="text-body-sm text-muted-text">{t("pages.inbox.mailPasswordsEncrypted")}</p>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
            {busy ? t("pages.inbox.testingConnection") : t("pages.inbox.testAndAddMailbox")}
          </Button>
        </form>
      ) : null}
    </section>
  );
}

function Field({
  label, name, type = "text", required = false, placeholder, defaultValue, autoComplete,
}: {
  label: string; name: string; type?: string; required?: boolean;
  placeholder?: string; defaultValue?: string; autoComplete?: string;
}) {
  return (
    <label className="block text-label-md font-medium text-secondary">
      {label}
      <Input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} autoComplete={autoComplete} className="mt-1" />
    </label>
  );
}
