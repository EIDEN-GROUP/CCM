"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, Lock, PlugZap, RefreshCw } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The five states every CCM data surface must be able to show.
 *
 * A screen that can only show data is not finished: users need to know
 * whether they are looking at nothing, at an error, at a permission problem,
 * or at a source that has not reported yet.
 */

export function LoadingState({
  label,
  className,
  rows = 3,
}: {
  label?: string;
  className?: string;
  rows?: number;
}) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("space-y-3", className)}
    >
      <span className="sr-only">{label ?? t("common.loading")}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-14 animate-pulse rounded-lg border border-border/70 bg-surface-muted/60"
          style={{ animationDelay: `${index * 90}ms` }}
        />
      ))}
    </div>
  );
}

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-4 animate-spin text-primary", className)}
    />
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-surface-muted text-muted-text"
      >
        {icon ?? <Inbox className="size-5" />}
      </span>
      <div className="max-w-md space-y-1">
        <h3 className="text-headline-sm font-semibold text-tertiary">
          {title ?? t("common.emptyTitle")}
        </h3>
        <p className="text-body-sm text-muted-text">
          {description ?? t("common.emptyBody")}
        </p>
      </div>
      {action}
    </div>
  );
}

export function NotConnectedState({
  provider,
  action,
  className,
}: {
  provider?: string;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-pale text-primary-ink"
      >
        <PlugZap className="size-5" />
      </span>
      <div className="max-w-md space-y-1">
        <h3 className="text-headline-sm font-semibold text-tertiary">
          {t("common.notConnectedTitle")}
        </h3>
        <p className="text-body-sm text-muted-text">
          {provider
            ? `${provider} — ${t("common.notConnectedBody")}`
            : t("common.notConnectedBody")}
        </p>
      </div>
      {action}
    </div>
  );
}

export function NeedsSetupState({
  provider,
  checklist,
  action,
  className,
}: {
  provider?: string;
  checklist?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "rounded-lg border border-warning/30 bg-warning-surface/50 px-6 py-8 text-start",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-surface text-warning"
        >
          <AlertTriangle className="size-4" />
        </span>
        <div className="space-y-2">
          <h3 className="text-headline-sm font-semibold text-tertiary">
            {provider
              ? `${provider} — ${t("common.needsSetupTitle")}`
              : t("common.needsSetupTitle")}
          </h3>
          {checklist}
          {action}
        </div>
      </div>
    </div>
  );
}

export function PermissionDeniedState({
  className,
  action,
}: {
  className?: string;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface-muted/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-surface text-muted-text"
      >
        <Lock className="size-5" />
      </span>
      <div className="max-w-md space-y-1">
        <h3 className="text-headline-sm font-semibold text-tertiary">
          {t("common.permissionDeniedTitle")}
        </h3>
        <p className="text-body-sm text-muted-text">
          {t("common.permissionDeniedBody")}
        </p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  detail,
  onRetry,
  className,
}: {
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-error/30 bg-error-surface/50 px-6 py-12 text-center",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-error-surface text-error"
      >
        <AlertTriangle className="size-5" />
      </span>
      <div className="max-w-md space-y-1">
        <h3 className="text-headline-sm font-semibold text-tertiary">
          {t("common.errorTitle")}
        </h3>
        <p className="text-body-sm text-muted-text">{t("common.errorBody")}</p>
        {detail ? (
          <p className="pt-1 text-body-sm text-error/90">{detail}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}

export function StaleDataNotice({
  ageLabel,
  className,
}: {
  ageLabel?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border border-warning/25 bg-warning-surface/60 px-4 py-2.5 text-body-sm text-warning",
        className,
      )}
    >
      <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
      <span className="font-semibold">{t("common.staleTitle")}</span>
      <span className="text-warning/85">{t("common.staleBody")}</span>
      {ageLabel ? <span className="text-warning/85">· {ageLabel}</span> : null}
    </div>
  );
}
