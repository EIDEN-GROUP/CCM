"use client";

import type { ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A contextual notice.
 *
 * Used for the standing explanations that must be visible on a screen — the
 * read-only banner on Google Ads, the privacy boundary on the inbox, the
 * honesty note on the launcher. These are not alerts; they are part of the
 * interface's contract with the user.
 */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  /* The border keeps the brand fill; the text uses the matching *-ink
     token, because the fills are too light to carry words (the error red
     measured 3.47:1 on its own surface, the amber 3.86:1). */
  const styles = {
    info: "border-primary/25 bg-pale text-primary-ink",
    warning: "border-warning/30 bg-warning-surface/70 text-warning-ink",
    danger: "border-error/30 bg-error-surface/70 text-error-ink",
    success: "border-primary/30 bg-pale text-primary-ink",
  } as const;

  const Icon = tone === "info" || tone === "success" ? Info : TriangleAlert;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-body-sm",
        styles[tone],
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {/* The body is painted in the notice's own ink at full strength. It
            used to be dimmed to 90%, which dropped the composite below
            4.5:1 on the pale surface (3.09:1) — the weight of the title
            already carries the hierarchy. */}
        <div className="text-current">{children}</div>
      </div>
    </div>
  );
}
