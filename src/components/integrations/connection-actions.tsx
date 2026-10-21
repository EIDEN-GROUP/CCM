"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  LoaderCircle,
  Plug,
  RefreshCw,
  Stethoscope,
  Unplug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useI18n } from "@/components/providers/i18n-provider";

/**
 * The actions on a connection row.
 *
 * Every action calls the server, and the server re-checks the permission
 * and writes an audit record. The button is disabled while the request is
 * in flight so a double click cannot queue two syncs.
 *
 * A connection that has never been authorised shows **Connect**, which
 * starts the provider's OAuth flow. When the provider's app has not been
 * configured yet, the button says so and takes the owner to the setup
 * screen rather than failing with an error.
 */
export function ConnectionActions({
  connectionId,
  providerKey,
  status,
  canManage,
  oauthProvider,
  appConfigured,
}: {
  connectionId: string;
  providerKey: string;
  status: string;
  canManage: boolean;
  /** The OAuth app that serves this provider, or null when it has none. */
  oauthProvider: string | null;
  /** Whether that app's client id and secret have been entered. */
  appConfigured: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheck] = useState<{
    ok: boolean;
    detail: string | null;
    accounts: Array<{ displayLabel: string }>;
  } | null>(null);

  async function act(action: "refresh" | "disconnect" | "check") {
    setBusy(true);
    setError(null);
    setCheck(null);

    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, connectionId }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Ask the provider whether it still accepts this credential.
   *
   * A connection can say "connected" and still be useless — the token was
   * revoked, the app lost its permissions, the account was unlinked. Only
   * the provider can settle it.
   */
  async function check() {
    setBusy(true);
    setError(null);
    setCheck(null);

    try {
      const response = await fetch("/api/connections/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const body = (await response.json().catch(() => null)) as {
        ok?: boolean;
        detail?: string | null;
        accounts?: Array<{ displayLabel: string }>;
        error?: string;
      } | null;

      if (!response.ok || !body) {
        setError(
          body?.error ?? `The check failed (HTTP ${response.status}).`,
        );
        return;
      }

      setCheck({
        ok: Boolean(body.ok),
        detail: body.detail ?? null,
        accounts: body.accounts ?? [],
      });
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  // A provider that has never been authorised is the "connect" case.
  if (status === "needs_setup" && oauthProvider) {
    if (!appConfigured) {
      return (
        <a
          href={`/settings/integrations?provider=${oauthProvider}`}
          className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md border border-warning/40 bg-surface px-3.5 text-label-md font-semibold text-warning transition-colors hover:bg-warning-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning"
        >
          <Plug aria-hidden="true" className="size-4" />
          {t("pages.settings.integrations.setUpApp")}
        </a>
      );
    }

    return (
      <a
        href={`/api/auth/${oauthProvider}/authorize?products=${providerKey}`}
        className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md border border-primary/35 bg-surface px-3.5 text-label-md font-semibold text-primary transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plug aria-hidden="true" className="size-4" />
        {t("common.connect")}
      </a>
    );
  }

  if (!canManage) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-body-sm text-error">
          {error}
        </span>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => act("refresh")}
        disabled={busy || pending}
        title={t("common.refresh")}
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <RefreshCw aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only sm:not-sr-only">{t("common.refresh")}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => void check()}
        disabled={busy || pending}
        title={t("pages.settings.integrations.check")}
      >
        {busy ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Stethoscope aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only sm:not-sr-only">
          {t("pages.settings.integrations.check")}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => act("disconnect")}
        disabled={busy || pending}
        className={cn("text-error hover:bg-error-surface")}
        title={t("common.disconnect")}
      >
        <Unplug aria-hidden="true" className="size-4" />
        <span className="sr-only sm:not-sr-only">{t("common.disconnect")}</span>
      </Button>
      </div>

      {checkResult ? (
        <span
          role="status"
          className={
            checkResult.ok
              ? "text-body-sm text-success"
              : "text-body-sm text-error"
          }
        >
          {checkResult.ok
            ? `Verified — ${checkResult.accounts.length} account(s) reachable.`
            : (checkResult.detail ?? "The provider refused the credential.")}
        </span>
      ) : null}
    </div>
  );
}
