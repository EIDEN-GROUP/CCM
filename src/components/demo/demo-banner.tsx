import { isDemoMode } from "@/lib/demo/fixtures";

/**
 * The demo-mode banner.
 *
 * Shown across the top of the shell whenever synthetic fixtures are in use.
 * The brief is explicit: a fixture must never be mistaken for live data, so
 * the banner is unmissable rather than a footnote.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-warning/30 bg-warning-surface px-4 py-2 text-body-sm text-warning-ink md:px-6"
    >
      <span className="rounded-full bg-warning-surface px-2 py-0.5 text-label-sm font-bold uppercase tracking-[0.04em]">
        Demo mode
      </span>
      <span>
        Synthetic fixtures are shown because no live source is connected. These
        numbers are not real analytics and must not be reported anywhere.
      </span>
    </div>
  );
}
