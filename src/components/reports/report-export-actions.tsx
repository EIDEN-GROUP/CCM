"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/providers/i18n-provider";

const KINDS = [
  { key: "ads", label: "Ads" },
  { key: "ga4", label: "Analytics" },
  { key: "gsc", label: "Search" },
  { key: "social", label: "Social" },
  { key: "websites", label: "Websites" },
  { key: "audit", label: "Audit log" },
];

/**
 * Report export.
 *
 * CSV is generated server-side so the exported values are exactly the
 * reviewed ones, with the same freshness and source caveats. "Share safe" is
 * on by default and masks customer, mailbox and sensitive account
 * identifiers.
 */
export function ReportExportActions() {
  const { t } = useI18n();
  const [kind, setKind] = useState("ads");
  const [safe, setSafe] = useState(true);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="export-kind" className="sr-only">
        {t("common.export")}
      </label>
      <select
        id="export-kind"
        value={kind}
        onChange={(event) => setKind(event.target.value)}
        className="h-[38px] rounded-md border border-border bg-surface px-2.5 text-label-md font-semibold text-secondary"
      >
        {KINDS.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-label-md text-secondary">
        <input
          type="checkbox"
          checked={safe}
          onChange={(event) => setSafe(event.target.checked)}
          className="size-4 rounded border-border accent-primary"
        />
        {t("pages.reports.safeMode")}
      </label>

      <a
        href={`/api/reports/export?kind=${kind}&safe=${safe ? "1" : "0"}`}
        className="inline-flex h-[38px] items-center justify-center gap-2 rounded-md border border-primary/35 bg-surface px-3.5 text-label-md font-semibold text-primary-ink transition-colors hover:bg-pale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ink"
      >
        <Download aria-hidden="true" className="size-4" />
        {t("pages.reports.exportCsv")}
      </a>

      <Button variant="ghost" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden="true" className="size-4" />
        {t("pages.reports.exportPdf")}
      </Button>
    </div>
  );
}
