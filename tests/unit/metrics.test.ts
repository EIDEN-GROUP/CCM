import { describe, expect, it } from "vitest";
import {
  UNAVAILABLE,
  addNullable,
  formatCount,
  formatRatio,
  sumNullable,
} from "@/domain/metrics";
import { coverageOf, sumSeries } from "@/domain/kpi";

/**
 * The rule these tests protect: **a missing number is not zero.**
 *
 * A provider that did not report a metric leaves it null. Turning that null
 * into a zero says "there was no traffic" when the truth is "nobody knows",
 * and a team that acts on a false zero switches off a campaign that was
 * working.
 */
describe("a missing number", () => {
  it("is not zero when two numbers are added", () => {
    expect(addNullable(1, 2)).toBe(3);
    expect(addNullable(0, 0)).toBe(0);
    expect(addNullable(null, 5)).toBeNull();
    expect(addNullable(5, null)).toBeNull();
    expect(addNullable(null, null)).toBeNull();
    expect(addNullable(undefined, 5)).toBeNull();
  });

  it("makes a total unknown when any part of it is unknown", () => {
    expect(sumNullable([1, 2, 3])).toBe(6);
    expect(sumNullable([1, null, 3])).toBeNull();
    expect(sumNullable([null, null])).toBeNull();
  });

  it("sums an empty list to zero, because nothing was measured about nothing", () => {
    expect(sumNullable([])).toBe(0);
  });

  it("reads as unavailable rather than as a digit", () => {
    expect(formatCount(null, "en-GB")).toBe(UNAVAILABLE);
    expect(formatCount(undefined, "en-GB")).toBe(UNAVAILABLE);
    expect(formatCount(Number.NaN, "en-GB")).toBe(UNAVAILABLE);
    expect(formatCount(0, "en-GB")).toBe("0");
    expect(formatCount(1234, "en-GB")).toBe("1,234");
  });

  it("reads a ratio with no denominator as unavailable, not as zero percent", () => {
    expect(formatRatio(0, 0, "en-GB")).toBe(UNAVAILABLE);
    expect(formatRatio(5, null, "en-GB")).toBe(UNAVAILABLE);
    expect(formatRatio(null, 5, "en-GB")).toBe(UNAVAILABLE);
    expect(formatRatio(0, 50, "en-GB")).toBe("0%");
    expect(formatRatio(25, 50, "en-GB")).toBe("50%");
    expect(formatRatio(1, 3, "en-GB")).toBe("33.3%");
  });
});

describe("the coverage of a period", () => {
  const series = (values: (number | null)[]) =>
    sumSeries(
      values.map((value) => ({
        value,
        source: "provider" as const,
        grain: "day" as const,
        fetchedAt: null,
      })),
    );

  it("counts the days that reported and the days that did not", () => {
    const result = series([10, null, 20]);
    expect(coverageOf(result)).toEqual({ present: 2, total: 3 });
    expect(result.missing).toBe(1);
    expect(result.total).toBe(3);
  });

  it("is null when nothing reported, not zero", () => {
    const result = series([null, null]);
    expect(result.value).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it("reports a partial total as partial, so a card can say so", () => {
    // The sum of what reported is 30, but the period had 3 days and one of
    // them said nothing. The card must be able to say "2 of 3 days".
    const result = series([10, 20, null]);
    expect(result.value).toBe(30);
    expect(coverageOf(result)).toEqual({ present: 2, total: 3 });
  });
});
