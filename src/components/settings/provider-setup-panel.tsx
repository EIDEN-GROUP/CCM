"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  LoaderCircle,
  Plug,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { useI18n } from "@/components/providers/i18n-provider";
import { ProviderIcon } from "@/components/providers/provider-icon";

/**
 * The provider app setup.
 *
 * The client id and the client secret of a provider's app used to mean
 * editing `.env` and redeploying. This screen is the replacement: the
 * owner pastes them here, the secret is encrypted before it is stored, and
 * the Connect button works immediately afterwards.
 *
 * The secret is never sent back to the browser. The field says so, and an
 * empty field leaves the stored secret alone.
 */

export interface ProviderSetup {
  key: string;
  displayName: string;
  clientIdLabel: string;
  secretLabel: string;
  secretRequired: boolean;
  setupUrl: string;
  docsUrl: string;
  requirement: string;
  redirectUriPath: string;
  products: Array<{ key: string; label: string }>;
}

export interface CredentialSummary {
  providerKey: string;
  clientId: string;
  hasSecret: boolean;
  redirectUri: string | null;
  scopes: string[];
  notes: string | null;
  updatedAt: string;
}

export function ProviderSetupPanel({
  providers,
  credentials,
  origin,
}: {
  providers: ProviderSetup[];
  credentials: CredentialSummary[];
  origin: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function save(providerKey: string, form: FormData) {
    setBusy(providerKey);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/settings/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerKey,
          clientId: String(form.get("clientId") ?? ""),
          // An empty field means "leave the stored secret alone".
          secret: String(form.get("secret") ?? ""),
          notes: String(form.get("notes") ?? ""),
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      setNotice("Saved. The secret is encrypted and is never shown again.");
      router.refresh();
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(providerKey: string) {
    setBusy(providerKey);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/settings/credentials?providerKey=${encodeURIComponent(providerKey)}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      setNotice("Removed.");
      router.refresh();
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("The clipboard is not available in this browser.");
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <Notice tone="success" title="Done">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" title="That did not work">
          {error}
        </Notice>
      ) : null}

      {providers.map((provider) => {
        const stored = credentials.find(
          (credential) => credential.providerKey === provider.key,
        );
        const redirectUri = origin
          ? `${origin}${provider.redirectUriPath}`
          : provider.redirectUriPath;

        return (
          <form
            key={provider.key}
            action={(formData) => void save(provider.key, formData)}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-label-lg font-semibold text-secondary">
                  <ProviderIcon providerKey={provider.key} className="size-5 shrink-0" />
                  {provider.displayName}
                  {stored ? (
                    <Chip tone="success">
                      <Check aria-hidden="true" className="size-3" />
                      Configured
                    </Chip>
                  ) : (
                    <Chip tone="warning">Not configured</Chip>
                  )}
                </h3>
                <p className="mt-1 text-body-sm text-muted-text">
                  {provider.requirement}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={provider.setupUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex h-[34px] items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-label-md font-semibold text-secondary transition-colors hover:bg-surface-muted"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  Create the app
                </a>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor={`clientId-${provider.key}`}
                  className="mb-1 block text-label-md font-semibold text-secondary"
                >
                  {provider.clientIdLabel}
                </label>
                <Input
                  id={`clientId-${provider.key}`}
                  name="clientId"
                  required
                  defaultValue={stored?.clientId ?? ""}
                  placeholder="1234567890"
                  autoComplete="off"
                />
              </div>

              <div>
                <label
                  htmlFor={`secret-${provider.key}`}
                  className="mb-1 block text-label-md font-semibold text-secondary"
                >
                  {provider.secretLabel}
                </label>
                <Input
                  id={`secret-${provider.key}`}
                  name="secret"
                  type={revealed[provider.key] ? "text" : "password"}
                  defaultValue=""
                  placeholder={
                    stored?.hasSecret
                      ? "Stored — leave blank to keep it"
                      : "Paste the secret"
                  }
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() =>
                    setRevealed((current) => ({
                      ...current,
                      [provider.key]: !current[provider.key],
                    }))
                  }
                  className="mt-1 text-body-sm font-semibold text-primary-ink hover:underline"
                >
                  {revealed[provider.key] ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="mt-3">
              <span className="mb-1 block text-label-md font-semibold text-secondary">
                Redirect URI to register
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-surface-muted px-2 py-1 font-mono text-label-sm text-secondary">
                  {redirectUri}
                </code>
                <button
                  type="button"
                  onClick={() => void copy(redirectUri)}
                  className="inline-flex items-center gap-1 text-body-sm font-semibold text-primary-ink hover:underline"
                >
                  {copied === redirectUri ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Copy aria-hidden="true" className="size-3.5" />
                  )}
                  {copied === redirectUri ? "Copied" : "Copy"}
                </button>
              </div>
              {origin ? null : (
                <p className="mt-1 flex items-start gap-1.5 text-body-sm text-warning-ink">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  Set NEXT_PUBLIC_APP_ORIGIN so the full redirect URI can be
                  copied.
                </p>
              )}
            </div>

            <div className="mt-3">
              <label
                htmlFor={`notes-${provider.key}`}
                className="mb-1 block text-label-md font-semibold text-secondary"
              >
                Notes
              </label>
              <Input
                id={`notes-${provider.key}`}
                name="notes"
                defaultValue={stored?.notes ?? ""}
                placeholder="Optional — for example which app this belongs to"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={busy === provider.key}
              >
                {busy === provider.key ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : null}
                Save
              </Button>

              {stored ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    disabled={busy === provider.key}
                    onClick={() =>
                      window.open(
                        `/api/auth/${provider.key}/authorize`,
                        "_blank",
                      )
                    }
                  >
                    <Plug aria-hidden="true" className="size-4" />
                    Connect
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="md"
                    disabled={busy === provider.key}
                    onClick={() => void remove(provider.key)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </Button>
                </>
              ) : null}
            </div>

            <p className="mt-3 text-body-sm text-muted-text">
              {t("pages.settings.integrations.secretNote")}
            </p>
          </form>
        );
      })}
    </div>
  );
}
