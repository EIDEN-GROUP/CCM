"use client";

import { Fragment, useState, type ReactNode } from "react";
import { LoaderCircle, Plug, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Notice } from "@/components/ui/notice";
import { useI18n } from "@/components/providers/i18n-provider";
import { ProviderIcon } from "@/components/providers/provider-icon";

/**
 * Quick connect.
 *
 * One place to start a provider's authorisation, for every provider that
 * has one. A provider whose app is already configured connects straight
 * away; a provider whose app is not configured says exactly that, and
 * links to the setup screen rather than failing with an error.
 */

/**
 * Render a translated sentence that carries a link.
 *
 * The link has to stay a link, and where it sits inside the sentence is the
 * translator's choice, so the sentence carries a placeholder instead.
 */
function withLink(template: string, link: ReactNode): ReactNode[] {
  return template.split(/(\{link\})/).map((part, index) =>
    part === "{link}" ? <Fragment key={index}>{link}</Fragment> : part,
  );
}

export interface ConnectableProvider {
  /** The OAuth app that serves it: google, meta or linkedin. */
  key: string;
  displayName: string;
  /** The provider keys this app can connect. */
  products: Array<{ key: string; label: string }>;
  /** Whether the client id and secret have been entered. */
  configured: boolean;
}

export function ConnectProviderButton({
  providers,
  canManage,
}: {
  providers: ConnectableProvider[];
  canManage: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!canManage) return null;

  if (!open) {
    return (
      <Button variant="primary" size="md" onClick={() => setOpen(true)}>
        <Plug aria-hidden="true" className="size-4" />
        {t("pages.integrations.connectProvider")}
      </Button>
    );
  }

  const ready = providers.filter((provider) => provider.configured);
  const notReady = providers.filter((provider) => !provider.configured);

  return (
    <div className="w-full rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-label-lg font-semibold text-secondary">
          <Plug aria-hidden="true" className="size-4" />
          {t("pages.integrations.connectProvider")}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("pages.integrations.close")}</span>
        </Button>
      </div>

      {ready.length === 0 ? (
        <Notice tone="warning" title={t("pages.integrations.noAppConfiguredTitle")}>
          {withLink(
            t("pages.integrations.noAppConfiguredBody"),
            <a
              href="/settings/integrations"
              className="font-semibold text-primary-ink underline"
            >
              {t("pages.integrations.providerAppsLink")}
            </a>,
          )}
        </Notice>
      ) : null}

      <ul className="mt-3 space-y-2">
        {[...ready, ...notReady].map((provider) => (
          <li
            key={provider.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted/50 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold text-tertiary">
                <ProviderIcon providerKey={provider.key} className="size-5 shrink-0" />
                {provider.displayName}
              </p>
              <p className="text-body-sm text-muted-text">
                {provider.products.map((product) => product.label).join(" · ")}
              </p>
            </div>

            {provider.configured ? (
              <a
                href={`/api/auth/${provider.key}/authorize?products=${provider.products
                  .map((product) => product.key)
                  .join(",")}`}
                className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md border border-primary/35 bg-surface px-3.5 text-label-md font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
              >
                <Plug aria-hidden="true" className="size-4" />
                {t("common.connect")}
              </a>
            ) : (
              <span className="flex items-center gap-2">
                <Chip tone="warning">
                  {t("pages.integrations.appNotConfigured")}
                </Chip>
                <a
                  href={`/settings/integrations?provider=${provider.key}`}
                  className="text-label-md font-semibold text-primary-ink hover:underline"
                >
                  {t("pages.integrations.setItUp")}
                </a>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A button that runs an action and reports what happened.
 *
 * Used by the reports screen, where "Generate a report" queues the digest
 * rather than pretending to have produced one.
 */
export function RunActionButton({
  label,
  action,
  payload,
  className,
}: {
  label: string;
  action: string;
  payload: Record<string, unknown>;
  className?: string;
}) {
  const { t, tp } = useI18n();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(
          body?.error ??
            tp("pages.reports.requestFailed", { status: response.status }),
        );
        return;
      }

      setMessage(body?.message ?? t("pages.reports.done"));
    } catch {
      setError(t("pages.reports.serverUnreachable"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button variant="primary" size="md" onClick={() => void run()} disabled={busy}>
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        {label}
      </Button>
      {message ? (
        <p role="status" className="mt-1 text-body-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-body-sm text-error-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
