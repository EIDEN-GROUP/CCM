"use client";

import { useState, useTransition, type FormEvent } from "react";
import { KeyRound, LoaderCircle, Plus, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { PROVIDER_LIST, type ProviderKey } from "@/providers/registry";
import { providerSupportsCredentialFill } from "@/lib/launch/credential-hosts";

const CREDENTIAL_PROVIDERS = PROVIDER_LIST.filter((provider) =>
  providerSupportsCredentialFill(provider.key),
);

export function AddLoginAccount({
  canManage,
  defaultOpen,
}: {
  canManage: boolean;
  defaultOpen: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultOpen);
  const [providerKey, setProviderKey] = useState<ProviderKey>(
    CREDENTIAL_PROVIDERS[0]?.key ?? "google_ads",
  );
  const [displayLabel, setDisplayLabel] = useState(
    CREDENTIAL_PROVIDERS[0]?.displayName ?? "",
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  if (!canManage) {
    return defaultOpen ? (
      <p className="rounded-md border border-border bg-surface px-4 py-3 text-body-sm text-muted-text">
        {t("pages.launcher.credentialsAskAdmin")}
      </p>
    ) : null;
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/launch/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerKey,
          displayLabel: displayLabel.trim(),
          username: username.trim(),
          password,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? t("pages.launcher.loginAccountCreateFailed"));

      setPassword("");
      setUsername("");
      setSaved(true);
      setExpanded(false);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("pages.launcher.loginAccountCreateFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!expanded) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {saved ? (
          <p role="status" className="text-body-sm font-medium text-success">
            <ShieldCheck aria-hidden="true" className="me-1 inline size-4 align-[-3px]" />
            {t("pages.launcher.loginAccountCreated")}
          </p>
        ) : null}
        <Button variant="secondary" onClick={() => setExpanded(true)}>
          <Plus aria-hidden="true" className="size-4" />
          {t("pages.launcher.addLoginAccount")}
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/25 shadow-card">
      <CardHeader
        title={t("pages.launcher.addLoginAccountTitle")}
        subtitle={t("pages.launcher.addLoginAccountSubtitle")}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(false)}
            aria-label={t("common.close")}
          >
            <X aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">{t("common.cancel")}</span>
          </Button>
        }
      />
      <CardBody>
        <form onSubmit={(event) => void saveAccount(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={t("pages.launcher.loginProvider")} htmlFor="login-provider" required>
              <Select
                id="login-provider"
                value={providerKey}
                onChange={(event) => {
                  const nextKey = event.target.value as ProviderKey;
                  setProviderKey(nextKey);
                  const next = CREDENTIAL_PROVIDERS.find((provider) => provider.key === nextKey);
                  if (next) setDisplayLabel(next.displayName);
                }}
              >
                {CREDENTIAL_PROVIDERS.map((provider) => (
                  <option key={provider.key} value={provider.key}>{provider.displayName}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("pages.launcher.loginAccountLabel")} htmlFor="login-account-label" required>
              <Input
                id="login-account-label"
                autoComplete="off"
                maxLength={120}
                value={displayLabel}
                onChange={(event) => setDisplayLabel(event.target.value)}
                required
              />
            </Field>
            <Field label={t("pages.launcher.loginUsername")} htmlFor="new-login-username" required>
              <Input
                id="new-login-username"
                autoComplete="username"
                maxLength={320}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </Field>
            <Field label={t("pages.launcher.loginPassword")} htmlFor="new-login-password" required>
              <Input
                id="new-login-password"
                type="password"
                autoComplete="new-password"
                maxLength={2048}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-body-sm text-muted-text">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-ink" />
              <span>{t("pages.launcher.loginAccountPrivacy")}</span>
            </p>
            <Button type="submit" disabled={busy || !displayLabel.trim() || !username.trim() || !password} className="w-full shrink-0 sm:w-auto">
              {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <KeyRound aria-hidden="true" className="size-4" />}
              {busy ? t("pages.launcher.savingLoginAccount") : t("pages.launcher.saveLoginAccount")}
            </Button>
          </div>
          {error ? <p role="alert" className="text-body-sm text-error-ink">{error}</p> : null}
        </form>
      </CardBody>
    </Card>
  );
}
