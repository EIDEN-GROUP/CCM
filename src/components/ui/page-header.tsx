"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/cn";

/**
 * Page header — title, subtitle, primary actions and a filter row.
 * Consistent across every workspace so the eye always finds the same anchors.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  filters,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  filters?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-headline-lg font-bold text-tertiary">{title}</h1>
          {subtitle ? (
            <p className="text-body-md text-muted-text">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {filters ? (
        <div className="no-print flex flex-wrap items-end gap-3">{filters}</div>
      ) : null}
    </header>
  );
}

/**
 * A labelled filter control used in page headers.
 */
export function FilterField({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-label-sm font-semibold uppercase tracking-[0.04em] text-muted-text">
        {label ?? t("common.filters")}
      </span>
      {children}
    </label>
  );
}
