"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/ui/notice";

/**
 * The scheduled digests.
 *
 * A definition says when a report should be built; a run is the report that
 * was built. Both are shown, because "the digest is scheduled" and "the
 * digest for Tuesday exists" are different facts.
 */

export interface DigestDefinition {
  id: string;
  key: string;
  title: string;
  description: string | null;
  cadence: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface DigestRun {
  id: string;
  definitionId: string | null;
  title: string;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  generatedAt: string;
  sections: Array<{
    key: string;
    title: string;
    source: string;
    available: boolean;
    unavailableReason?: string;
    metrics: Array<{
      label: string;
      value: number | null;
      unit: string | null;
      formula?: string | null;
    }>;
    caveats?: string[];
  }>;
  caveats: string[];
}

export function DigestCatalogue({
  definitions,
  runs,
}: {
  definitions: DigestDefinition[];
  runs: DigestRun[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  async function runNow(definitionId: string) {
    setBusy(definitionId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definitionId }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? `The request failed (HTTP ${response.status}).`);
        return;
      }

      setNotice(body?.message ?? "The digest has been queued.");
      router.refresh();
    } catch {
      setError("CCM could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  if (definitions.length === 0) {
    return (
      <EmptyState
        title="No digest is scheduled"
        description="Apply supabase/repair.sql to create the daily, weekly and monthly digests for this workspace."
        icon={<CalendarClock aria-hidden="true" className="size-5" />}
        className="border-0"
      />
    );
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <Notice tone="success" title="Digest queued">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" title="The digest could not be queued">
          {error}
        </Notice>
      ) : null}

      <ul className="grid gap-3 md:grid-cols-3">
        {definitions.map((definition) => (
          <li
            key={definition.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-label-lg font-semibold text-secondary">
                {definition.title}
              </h3>
              <Chip tone={definition.enabled ? "teal" : "neutral"}>
                {definition.cadence}
              </Chip>
            </div>

            {definition.description ? (
              <p className="mt-1 text-body-sm text-muted-text">
                {definition.description}
              </p>
            ) : null}

            <dl className="mt-3 space-y-1 text-body-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-text">Last run</dt>
                <dd className="font-semibold text-tertiary">
                  {definition.lastRunAt
                    ? new Date(definition.lastRunAt).toLocaleString()
                    : "Never"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-text">Next run</dt>
                <dd className="font-semibold text-tertiary">
                  {definition.nextRunAt
                    ? new Date(definition.nextRunAt).toLocaleString()
                    : "Not scheduled"}
                </dd>
              </div>
            </dl>

            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => void runNow(definition.id)}
              disabled={busy !== null}
            >
              {busy === definition.id ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Play aria-hidden="true" className="size-4" />
              )}
              Build now
            </Button>
          </li>
        ))}
      </ul>

      {runs.length > 0 ? (
        <div>
          <h3 className="mb-2 text-label-lg font-semibold text-secondary">
            Recent digests
          </h3>
          <ul className="divide-y divide-border/70 rounded-lg border border-border bg-surface">
            {runs.map((run) => {
              const isOpen = openRun === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setOpenRun(isOpen ? null : run.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-muted"
                  >
                    {isOpen ? (
                      <ChevronDown
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-text"
                      />
                    ) : (
                      <ChevronRight
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-text"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-tertiary">
                        {run.title}
                      </span>
                      <span className="block text-body-sm text-muted-text">
                        {run.periodStart ?? "—"} to {run.periodEnd ?? "—"}
                      </span>
                    </span>
                    <Chip
                      tone={
                        run.status === "ready"
                          ? "success"
                          : run.status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {run.status}
                    </Chip>
                  </button>

                  {isOpen ? (
                    <div className="space-y-4 px-4 pb-4">
                      {run.sections.map((section) => (
                        <div key={section.key}>
                          <h4 className="text-label-md font-semibold text-secondary">
                            {section.title}
                            <span className="ms-2 font-normal text-muted-text">
                              {section.source}
                            </span>
                          </h4>

                          {!section.available ? (
                            <p className="mt-1 text-body-sm text-muted-text">
                              {section.unavailableReason ??
                                "No data was available for this period."}
                            </p>
                          ) : section.metrics.length > 0 ? (
                            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-body-sm md:grid-cols-3">
                              {section.metrics.map((metric) => (
                                <div key={metric.label}>
                                  <dt className="text-muted-text">
                                    {metric.label}
                                  </dt>
                                  <dd className="font-semibold text-tertiary">
                                    {metric.value === null
                                      ? "—"
                                      : `${metric.value.toLocaleString()}${
                                          metric.unit ? ` ${metric.unit}` : ""
                                        }`}
                                    {metric.formula ? (
                                      <span className="ms-1 font-normal text-muted-text">
                                        ({metric.formula})
                                      </span>
                                    ) : null}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}

                          {section.caveats?.length ? (
                            <ul className="mt-1 space-y-0.5">
                              {section.caveats.map((caveat, index) => (
                                <li
                                  key={index}
                                  className="text-body-sm text-muted-text"
                                >
                                  {caveat}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}

                      {run.caveats.length > 0 ? (
                        <div className="rounded-md border border-border bg-surface-muted/60 px-3 py-2">
                          <h4 className="text-label-md font-semibold text-secondary">
                            Caveats
                          </h4>
                          <ul className="mt-1 space-y-0.5">
                            {run.caveats.map((caveat, index) => (
                              <li
                                key={index}
                                className="text-body-sm text-muted-text"
                              >
                                {caveat}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
