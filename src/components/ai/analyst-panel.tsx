"use client";

import { useState } from "react";
import { LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";

interface Source {
  sourceType: string;
  sourceRef: string;
  label: string;
  periodStart: string | null;
  periodEnd: string | null;
  fetchedAt: string | null;
  excerpt: string | null;
}

interface Caveat {
  kind: string;
  message: string;
}

/**
 * The AI analyst panel.
 *
 * It shows the answer, the records the answer was built from, and the
 * caveats. An answer with no sources is presented as ungrounded rather than
 * dressed up as a finding.
 */
export function AnalystPanel({ enabled }: { enabled: boolean }) {
  const { t } = useI18n();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{
    text: string;
    grounded: boolean;
    sources: Source[];
    caveats: Caveat[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    if (question.trim().length < 3) return;

    setBusy(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch("/api/ai/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const body = (await response.json().catch(() => null)) as
        | {
            answer?: string;
            grounded?: boolean;
            sources?: Source[];
            caveats?: Caveat[];
            error?: string;
          }
        | null;

      if (!response.ok || !body) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      setAnswer({
        text: body.answer ?? "",
        grounded: body.grounded ?? false,
        sources: body.sources ?? [],
        caveats: body.caveats ?? [],
      });
      setQuestion("");
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="AI analyst"
        subtitle="Answers grounded in synced records, with the sources shown."
      />
      <CardBody className="space-y-4">
        {!enabled ? (
          <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-surface/60 px-3 py-2 text-body-sm text-warning-ink">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              The model key is not configured, so the analyst reports what it can
              verify and nothing it cannot. The figures on screen come from
              the synced records, not from a model.
            </span>
          </p>
        ) : null}

        <form onSubmit={ask} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="analyst-question" className="sr-only">
            {t("pages.reports.ask")}
          </label>
          <Input
            id="analyst-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t("pages.reports.askPlaceholder")}
            maxLength={2000}
            className="flex-1"
          />
          <Button type="submit" disabled={busy || question.trim().length < 3}>
            {busy ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            {t("pages.reports.ask")}
          </Button>
        </form>

        {error ? (
          <p role="alert" className="text-body-sm text-error-ink">
            {error}
          </p>
        ) : null}

        {answer ? (
          <div className="space-y-3">
            <div
              className={
                answer.grounded
                  ? "rounded-md border border-border bg-surface-muted/60 px-4 py-3 text-body-md text-secondary"
                  : "rounded-md border border-warning/30 bg-warning-surface/60 px-4 py-3 text-body-md text-warning-ink"
              }
            >
              <p className="whitespace-pre-wrap">{answer.text}</p>
            </div>

            {answer.caveats.length > 0 ? (
              <div>
                <h3 className="text-label-md font-semibold text-secondary">
                  {t("pages.reports.caveats")}
                </h3>
                <ul className="mt-1 space-y-1">
                  {answer.caveats.map((caveat, index) => (
                    <li key={index} className="text-body-sm text-muted-text">
                      <Chip tone="neutral" className="me-2">
                        {caveat.kind}
                      </Chip>
                      {caveat.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {answer.sources.length > 0 ? (
              <div>
                <h3 className="text-label-md font-semibold text-secondary">
                  {t("pages.reports.sources")}
                </h3>
                <ul className="mt-1 space-y-1">
                  {answer.sources.map((source, index) => (
                    <li key={index} className="text-body-sm text-muted-text">
                      <span className="font-semibold text-secondary">
                        {source.label}
                      </span>
                      {source.excerpt ? ` — ${source.excerpt}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
