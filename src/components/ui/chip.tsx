import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone =
  | "neutral"
  | "teal"
  | "success"
  | "warning"
  | "danger"
  | "info";

/* The warning and danger tones carry their *-ink token, because the fills
   are too light to carry words: the amber measured 3.86:1 on its own
   surface and the red 3.47:1. The surfaces stay the brand fills. */
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-muted text-secondary border-border",
  teal: "bg-pale text-primary-ink border-transparent",
  success: "bg-surface-muted text-success border-transparent",
  info: "bg-surface-muted text-secondary border-border",
  warning: "bg-warning-surface text-warning-ink border-transparent",
  danger: "bg-error-surface text-error-ink border-transparent",
};

/**
 * Chip — Design.md: compact, fully rounded, teal-accented. Reserved for
 * filters, tags and small status indicators.
 */
export function Chip({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-label-md font-semibold",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const DOT_TONES: Record<Tone, string> = {
  neutral: "bg-muted-text",
  teal: "bg-primary",
  success: "bg-success",
  info: "bg-secondary",
  warning: "bg-warning",
  danger: "bg-error",
};

/**
 * Status indicator with a leading dot. The dot is decorative; the status
 * text carries the meaning, so colour is never the only signal.
 */
export function StatusBadge({
  label,
  tone = "neutral",
  className,
  title,
}: {
  label: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-2 text-label-md font-semibold",
        TONES[tone].split(" ").slice(1).join(" "),
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", DOT_TONES[tone])}
      />
      <span>{label}</span>
    </span>
  );
}
