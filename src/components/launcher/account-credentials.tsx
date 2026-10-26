"use client";

import { useEffect, useState } from "react";
import { KeyRound, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { providerSupportsCredentialFill } from "@/lib/launch/credential-hosts";
import type { ProviderKey } from "@/providers/registry";
import { isExtensionPaired } from "@/lib/launch/client";

export function AccountCredentials({
  accountId,
  providerKey,
  canManage,
  canAutofill,
  onAutofill,
}: {
  accountId: string;
  providerKey: ProviderKey;
  canManage: boolean;
  canAutofill: boolean;
  onAutofill: () => void;
}) {
  const { t } = useI18n();
  const [saved, setSaved] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [extensionReady, setExtensionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opened, setOpened] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = providerSupportsCredentialFill(providerKey);
  const usernameId = `login-username-${accountId}`;
  const passwordId = `login-password-${accountId}`;

  useEffect(() => {
    if (!opened || checked) return;
    let active = true;
    void Promise.all([
      fetch(`/api/launch/credentials?accountId=${encodeURIComponent(accountId)}`, {
        cache: "no-store",
      }).then(async (response) => {
        if (!response.ok) throw new Error(t("pages.launcher.credentialsCheckFailed"));
        return (await response.json()) as { saved: boolean; username?: string };
      }),
      isExtensionPaired(),
    ])
      .then(([credentials, extension]) => {
        if (!active) return;
        setSaved(credentials.saved);
        setUsername(credentials.username ?? "");
        setExtensionReady(extension);
        setChecked(true);
      })
      .catch(() => {
        if (active) setError(t("pages.launcher.credentialsCheckFailed"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountId, checked, opened, t]);

  async function mutate(action: "save" | "delete") {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/launch/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "save"
            ? { action, accountId, username: username.trim(), password }
            : { action, accountId },
        ),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        saved?: boolean;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? t("pages.launcher.credentialsSaveFailed"));
      setSaved(Boolean(body?.saved));
      if (action === "save") {
        setPassword("");
        setMessage(t("pages.launcher.credentialsSaved"));
      } else {
        setUsername("");
        setPassword("");
        setMessage(t("pages.launcher.credentialsRemoved"));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("pages.launcher.credentialsSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (!supported) return null;

  return (
    <details
      className="rounded-md border border-border bg-surface-muted/50 p-3"
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        setOpened(nextOpen);
        if (nextOpen && !checked) {
          setLoading(true);
          setError(null);
        }
      }}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-sm text-label-md font-semibold text-primary-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink [&::-webkit-details-marker]:hidden">
        <KeyRound aria-hidden="true" className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">
          {saved ? t("pages.launcher.credentialsSavedLabel") : t("pages.launcher.credentialsAddLabel")}
        </span>
        {saved ? <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-success" /> : null}
      </summary>

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        <p className="text-body-sm text-muted-text">
          {t("pages.launcher.credentialsPrivacy")}
        </p>

        {loading ? (
          <p className="flex items-center gap-2 text-body-sm text-muted-text">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {t("pages.launcher.credentialsChecking")}
          </p>
        ) : canManage ? (
          <>
            <Field label={t("pages.launcher.loginUsername")} htmlFor={usernameId} required>
              <Input
                id={usernameId}
                autoComplete="off"
                maxLength={320}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </Field>
            <Field
              label={t("pages.launcher.loginPassword")}
              htmlFor={passwordId}
              hint={saved ? t("pages.launcher.passwordReplaceHint") : undefined}
              required={!saved}
            >
              <Input
                id={passwordId}
                type="password"
                autoComplete="new-password"
                maxLength={2048}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required={!saved}
              />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                size="sm"
                onClick={() => void mutate("save")}
                disabled={saving || !username.trim() || !password}
                className="w-full sm:w-auto"
              >
                {saving ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : null}
                {t("pages.launcher.saveLogin")}
              </Button>
              {saved ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void mutate("delete")}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  {t("pages.launcher.removeLogin")}
                </Button>
              ) : null}
            </div>
          </>
        ) : saved ? (
          <p className="text-body-sm text-muted-text">{t("pages.launcher.credentialsManagedByAdmin")}</p>
        ) : (
          <p className="text-body-sm text-muted-text">{t("pages.launcher.credentialsAskAdmin")}</p>
        )}

        {saved && extensionReady && canAutofill ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAutofill}
            className="w-full sm:w-auto"
          >
            <KeyRound aria-hidden="true" className="size-4" />
            {t("pages.launcher.openAndFill")}
          </Button>
        ) : saved ? (
          <p className="rounded-md border border-warning/25 bg-warning-surface/60 px-3 py-2 text-body-sm text-warning-ink">
            {canAutofill
              ? t("pages.launcher.credentialsExtensionRequired")
              : t("pages.launcher.credentialsHelperProfile")}
          </p>
        ) : null}

        {message ? <p role="status" className="text-body-sm text-primary-ink">{message}</p> : null}
        {error ? <p role="alert" className="text-body-sm text-error-ink">{error}</p> : null}
      </div>
    </details>
  );
}
