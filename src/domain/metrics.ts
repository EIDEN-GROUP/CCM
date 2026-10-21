/**
 * Counting, honestly.
 *
 * The rule this module exists to enforce: **a missing number is not zero.**
 *
 * A provider that did not report a metric leaves it null. Turning that null
 * into a zero says "there was no traffic" when the truth is "nobody knows".
 * The difference matters in a marketing console: a team that acts on a false
 * zero switches off a campaign that was working.
 *
 * So a total is unknown whenever any part of it is unknown, and unknown is
 * rendered as an em dash rather than a digit.
 */

/**
 * Add two numbers, where either may be unknown.
 *
 * A total that includes an unknown part is itself unknown.
 */
export function addNullable(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a === null || a === undefined || b === null || b === undefined) {
    return null;
  }
  return a + b;
}

/**
 * Sum a list of numbers, where any may be unknown.
 *
 * An empty list sums to zero: nothing was measured, and nothing was
 * measured *about nothing*. A list containing an unknown sums to unknown.
 */
export function sumNullable(
  values: readonly (number | null | undefined)[],
): number | null {
  let total: number | null = 0;

  for (const value of values) {
    total = addNullable(total, value);
    if (total === null) return null;
  }

  return total;
}

/** The mark used for a value nobody can say. */
export const UNAVAILABLE = "—";

/**
 * Format a count for a person.
 *
 * An unknown count reads as an em dash, never as a zero.
 */
export function formatCount(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return UNAVAILABLE;
  }
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format a percentage, where an unknown reads as an em dash.
 *
 * A zero denominator is **not** a zero percent — it means the calculation
 * has no answer.
 */
export function formatRatio(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  locale: string,
  options: { maximumFractionDigits?: number } = {},
): string {
  if (
    numerator === null ||
    numerator === undefined ||
    denominator === null ||
    denominator === undefined
  ) {
    return UNAVAILABLE;
  }
  if (denominator === 0) return UNAVAILABLE;

  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
  }).format(numerator / denominator);
}
