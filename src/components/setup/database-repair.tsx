"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/components/providers/i18n-provider";
import { formatMessage, type Translator } from "@/lib/i18n";

/**
 * The database repair notice.
 *
 * If the Row Level Security authorisation layer is not installed, every
 * signed-in user sees an empty product. This panel states that plainly and
 * gives the exact command, rather than leaving the operator to guess.
 */

/**
 * Render a translated sentence that carries an inline element.
 *
 * A file name and a code element have to survive the translation intact, so
 * they travel as placeholders and the sentence decides where they sit.
 */
function withParts(
  template: string,
  parts: Record<string, ReactNode>,
): ReactNode[] {
  return template.split(/(\{\w+\})/).map((part, index) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (!name) return part;
    return <Fragment key={index}>{parts[name] ?? part}</Fragment>;
  });
}

/**
 * The API explains its failures in English, because it is a developer-facing
 * surface. The panel translates the ones it knows and keeps anything else
 * as it came, so a new diagnostic is never hidden.
 */
function translateReason(t: Translator, reason: string): string {
  if (reason.includes("not visible to PostgREST")) {
    return t("pages.settings.database.layerMissing");
  }
  const status = /returned (\d+)/.exec(reason)?.[1];
  if (status) {
    return formatMessage(t("pages.settings.database.checkReturned"), { status });
  }
  if (reason.includes("could not run")) {
    return formatMessage(t("pages.settings.database.checkFailedWithDetail"), {
      detail: reason.slice(reason.indexOf(":") + 1).trim(),
    });
  }
  return reason;
}

export function DatabaseRepair() {
  const { t } = useI18n();
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "ok" }
    | { kind: "broken"; reason: string }
    | { kind: "unknown"; reason: string }
  >({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/health/database", {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          configured: boolean;
          authorisationLayer: { ready: boolean; reason: string | null } | null;
        };

        if (cancelled) return;

        if (!body.configured) {
          setState({
            kind: "unknown",
            reason: t("pages.settings.database.notConfigured"),
          });
          return;
        }
        if (body.authorisationLayer?.ready) {
          setState({ kind: "ok" });
          return;
        }
        setState({
          kind: "broken",
          reason: body.authorisationLayer?.reason
            ? translateReason(t, body.authorisationLayer.reason)
            : t("pages.settings.database.layerNotFound"),
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          kind: "unknown",
          reason:
            error instanceof Error
              ? error.message
              : t("pages.settings.database.checkFailed"),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  if (state.kind === "checking") {
    return (
      <Card>
        <CardHeader
          title={t("pages.settings.database.title")}
          subtitle={t("pages.settings.database.checking")}
        />
        <CardBody>
          <p className="flex items-center gap-2 text-body-sm text-muted-text">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {t("pages.settings.database.checkingRls")}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (state.kind === "ok") {
    return (
      <Card>
        <CardHeader
          title={t("pages.settings.database.title")}
          subtitle={t("pages.settings.database.authorisationLayer")}
        />
        <CardBody>
          <p className="flex items-center gap-2 text-body-sm text-primary-ink">
            <CircleCheck aria-hidden="true" className="size-4" />
            {t("pages.settings.database.layerReady")}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title={t("pages.settings.database.repairTitle")}
        subtitle={t("pages.settings.database.repairSubtitle")}
      />
      <CardBody className="space-y-3">
        <p className="flex items-start gap-2 text-body-sm text-warning-ink">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.reason}
        </p>

        <div className="rounded-md border border-border bg-surface-muted p-4">
          <p className="text-label-md font-semibold text-secondary">
            {t("pages.settings.database.applyRepair")}
          </p>
          <p className="mt-1 text-body-sm text-muted-text">
            {t("pages.settings.database.repairBody")}
          </p>

          <ol className="mt-3 list-decimal space-y-2 ps-5 text-body-sm text-secondary">
            <li>
              {withParts(t("pages.settings.database.stepOne"), {
                editor: (
                  <strong className="font-semibold">SQL Editor</strong>
                ),
              })}
            </li>
            <li>
              {withParts(t("pages.settings.database.stepTwo"), {
                file: (
                  <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
                    supabase/repair.sql
                  </code>
                ),
              })}
            </li>
            <li>{t("pages.settings.database.stepThree")}</li>
          </ol>

          <p className="mt-3 text-body-sm text-muted-text">
            {t("pages.settings.database.terminalLead")}{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-label-sm">
              psql &quot;$DATABASE_URL&quot; -f supabase/repair.sql
            </code>
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.location.reload()}
        >
          {t("pages.settings.database.recheck")}
        </Button>
      </CardBody>
    </Card>
  );
}
