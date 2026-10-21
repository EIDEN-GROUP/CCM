import type { RangePreset } from "@/domain/dates";
import { resolveRange } from "@/domain/dates";

/**
 * Resolve the date range for a page from its search parameters.
 *
 * The range is part of the URL so that the server can query exactly the
 * window the user asked for, and so a report link reproduces what the user
 * was looking at.
 */
export function resolveRangeFromParams(
  params: Record<string, string | string[] | undefined>,
  today: string,
): {
  range: { start: string; end: string; preset: RangePreset };
  current: { start: string; end: string };
  previous: { start: string; end: string };
} {
  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const preset = single(params.range);
  const from = single(params.from);
  const to = single(params.to);

  if (from && to) {
    try {
      const resolved = resolveRange("custom", today, { start: from, end: to });
      return {
        range: { start: from, end: to, preset: "custom" },
        current: resolved.current,
        previous: resolved.previous,
      };
    } catch {
      // An invalid custom range falls back to the default rather than
      // rendering an error page.
    }
  }

  const safePreset: RangePreset =
    preset === "7d" || preset === "28d" || preset === "90d" ? preset : "28d";
  const resolved = resolveRange(safePreset, today);

  return {
    range: {
      start: resolved.current.start,
      end: resolved.current.end,
      preset: safePreset,
    },
    current: resolved.current,
    previous: resolved.previous,
  };
}
