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
  const styles = {
    info: "border-primary/25 bg-pale text-primary-ink",
    warning: "border-warning/30 bg-warning-surface/70 text-warning",
    danger: "border-error/30 bg-error-surface/70 text-error",
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
        <div className="text-current/90">{children}</div>
      </div>
    </div>
  );
}
