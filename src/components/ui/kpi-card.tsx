"use client";

import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/cn";

export interface KpiCardProps {
  label: string;
  /** Formatted value. Use "—" when the metric is unavailable, never 0. */
  value: string;
  /** Change descriptor from `describeChange`. */
  change?: {
    ratio: number | null;
    direction: "up" | "down" | "flat" | "unknown";
    magnitudeOnly: boolean;
  } | null;
  /** Absolute change when a percentage would be misleading. */
  absolute?: string | null;
  /** Small inline sparkline values, if available. */
  trend?: number[];
  /** Where the number came from and when it was fetched. */
  source?: {
    label: string;
    fetchedAt: string | null;
    /**
     * Pre-computed age, e.g. "4 min ago". Computed on the server so the
     * component stays pure during render.
     */
    ageLabel?: string;
  } | null;
  /** True when the value is a synthetic fixture. */
  isFixture?: boolean;
  /** Rendered on the right of the header — filters, menus, actions. */
  actions?: ReactNode;
  className?: string;
}

/**
 * KPI card — the compact metric tile used across the command center.
 *
 * Missing data renders as "—". A change is only shown when the comparison is
 * meaningful; when the previous value was zero the card states the absolute
 * movement instead of a fake percentage.
 */
export function KpiCard({
  label,
  value,
  change,
  absolute,
  trend,
  source,
  isFixture,
  actions,
  className,
}: KpiCardProps) {
  const { t } = useI18n();
  const isUp = change?.direction === "up";
  const isDown = change?.direction === "down";
  const isFlat = change?.direction === "flat";

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-card",
        className,
      )}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-label-md font-semibold text-secondary">{label}</h3>
        {actions}
      </div>

      <p
        className="text-headline-md font-bold text-tertiary data-[numeric=true]:tabular-nums"
        data-numeric="true"
      >
        {value}
      </p>

      <div className="flex min-h-[20px] flex-wrap items-center gap-2">
        {change ? (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-label-md font-semibold",
                isUp && "text-primary-ink",
                isDown && "text-error",
                (isFlat || change.direction === "unknown") && "text-muted-text",
              )}
            >
              {isUp ? (
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              ) : isDown ? (
                <ArrowDownRight aria-hidden="true" className="size-3.5" />
              ) : (
                <Minus aria-hidden="true" className="size-3.5" />
              )}
              {change.ratio !== null
                ? `${change.ratio > 0 ? "+" : ""}${(change.ratio * 100).toFixed(1)}%`
                : (absolute ?? "—")}
            </span>
            <span className="text-body-sm text-muted-text">
              {t("common.vsPrevious")}
            </span>
          </>
        ) : null}

        {trend && trend.length > 1 ? (
          <MiniSparkline values={trend} />
        ) : null}
      </div>

      {source || isFixture ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5 text-body-sm text-muted-text">
          {isFixture ? (
            <span className="rounded-full bg-warning-surface px-2 py-0.5 text-label-sm font-semibold text-warning">
              {t("demo.label")}
            </span>
          ) : null}
          {source ? (
            <span title={source.fetchedAt ?? undefined}>
              {source.label}
              {source.ageLabel ? ` · ${source.ageLabel}` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * A very small trend line. It is decorative support for the number above it,
 * so it is hidden from assistive technology and never the only signal.
 */
function MiniSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const width = 64;
  const height = 20;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible text-primary"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
