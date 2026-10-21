"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The error boundary for the application group.
 *
 * When a screen throws, this replaces it with something that says what
 * happened and offers a way out — and, crucially, shows the **reference**
 * rather than the error. An error message can carry a provider response, a
 * query or a fragment of somebody's data, so it is never rendered.
 *
 * The error is still recorded: it goes to the server log, and the reference
 * ties it to that entry.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Only the reference is logged. The error itself can carry a provider
    // response or a fragment of somebody's data, and the browser console is
    // not a safe place for it.
    console.error(`[ccm] an application screen failed (${error.digest ?? "no reference"})`);
  }, [error]);

  const reference = error.digest ?? "unknown";

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-11 items-center justify-center rounded-full bg-error-surface text-error-ink"
        >
          <TriangleAlert className="size-5" />
        </span>

        <div className="space-y-2">
          <h1 className="text-headline-lg font-bold text-tertiary">
            This screen could not load
          </h1>
          <p className="text-body-md text-muted-text">
            The failure has been recorded. The reference below ties it to the
            entry in the server log, so the cause can be found without
            guessing.
          </p>
        </div>

        <p className="rounded-md border border-border bg-surface-muted/60 px-3 py-2 font-mono text-body-sm text-secondary">
          Reference: {reference}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="primary" size="md" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" />
            Try again
          </Button>
          <Link
            href="/overview"
            className="inline-flex h-[47px] items-center justify-center rounded-md border border-primary/35 bg-surface px-[25px] text-button-text font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
          >
            Go to the overview
          </Link>
        </div>
      </div>
    </div>
  );
}
