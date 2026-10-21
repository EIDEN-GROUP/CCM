"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Eye, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";

/**
 * The actions on an alert row.
 *
 * Acknowledging assigns the alert to the person who acknowledged it. Resolving
 * records who resolved it and when. Both are written to the audit log by the
 * server.
 */
export function AlertActions({
  alertId,
  status,
  canManage,
}: {
  alertId: string;
  status: string;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "acknowledge" | "resolve") {
    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }
      router.refresh();
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (!canManage || status === "resolved") {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="text-body-sm text-error-ink">
          {error}
        </span>
      ) : null}

      {status === "open" ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => act("acknowledge")}
          disabled={busy !== null}
        >
          {busy === "acknowledge" ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
          {t("pages.alerts.acknowledge")}
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => act("resolve")}
        disabled={busy !== null}
      >
        {busy === "resolve" ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Check aria-hidden="true" className="size-4" />
        )}
        {t("pages.alerts.resolve")}
      </Button>
    </div>
  );
}
