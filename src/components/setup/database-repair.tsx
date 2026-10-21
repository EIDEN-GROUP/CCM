"use client";

import { useEffect, useState } from "react";
import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

/**
 * The database repair notice.
 *
 * If the Row Level Security authorisation layer is not installed, every
 * signed-in user sees an empty product. This panel states that plainly and
 * gives the exact command, rather than leaving the operator to guess.
 */
export function DatabaseRepair() {
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
            reason:
              "Supabase is not configured, so the database could not be checked.",
          });
          return;
        }
        if (body.authorisationLayer?.ready) {
          setState({ kind: "ok" });
          return;
        }
        setState({
          kind: "broken",
          reason:
            body.authorisationLayer?.reason ??
            "The authorisation layer could not be found.",
        });
      } catch (error) {
        if (cancelled) return;
        setState({
          kind: "unknown",
          reason:
            error instanceof Error
              ? error.message
              : "The database check could not run.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "checking") {
    return (
      <Card>
        <CardHeader
          title="Database"
          subtitle="Checking the authorisation layer"
        />
        <CardBody>
          <p className="flex items-center gap-2 text-body-sm text-muted-text">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Checking whether Row Level Security is installed…
          </p>
        </CardBody>
      </Card>
    );
  }

  if (state.kind === "ok") {
    return (
      <Card>
        <CardHeader title="Database" subtitle="Authorisation layer" />
        <CardBody>
          <p className="flex items-center gap-2 text-body-sm text-primary-ink">
            <CircleCheck aria-hidden="true" className="size-4" />
            Row Level Security is installed and the permission matrix is in
            place. Every query is scoped by the database.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Database repair required"
        subtitle="Row Level Security is not installed, so every user sees an empty product"
      />
      <CardBody className="space-y-3">
        <p className="flex items-start gap-2 text-body-sm text-warning">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.reason}
        </p>

        <div className="rounded-md border border-border bg-surface-muted p-4">
          <p className="text-label-md font-semibold text-secondary">
            Apply the repair
          </p>
          <p className="mt-1 text-body-sm text-muted-text">
            The repair file rebuilds the helper functions, every policy and
            the seed data, and tells PostgREST to reload its schema cache. It
            is idempotent.
          </p>

          <ol className="mt-3 list-decimal space-y-2 ps-5 text-body-sm text-secondary">
            <li>
              Open the project&apos;s{" "}
              <strong>SQL Editor</strong> in the Supabase dashboard.
            </li>
            <li>
              Open <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">supabase/repair.sql</code>{" "}
              in this repository and paste its contents.
            </li>
            <li>
              Run it, then reload this page.
            </li>
          </ol>

          <p className="mt-3 text-body-sm text-muted-text">
            From a terminal with the project linked, the same repair is:{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-[13px]">
              psql &quot;$DATABASE_URL&quot; -f supabase/repair.sql
            </code>
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.location.reload()}
        >
          Re-check
        </Button>
      </CardBody>
    </Card>
  );
}
