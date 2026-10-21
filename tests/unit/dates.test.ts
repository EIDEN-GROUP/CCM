import { describe, expect, it } from "vitest";
import {
  addDays,
  assertIsoDay,
  clampRange,
  diffDaysInclusive,
  eachDay,
  firstAvailableDay,
  isDayReportable,
  REPORTING_LAG,
  resolveRange,
} from "@/domain/dates";

describe("date ranges", () => {
  it("resolves a 7 day window ending on today", () => {
    const resolved = resolveRange("7d", "2026-03-10");
    expect(resolved.current).toEqual({
      start: "2026-03-04",
      end: "2026-03-10",
    });
    expect(resolved.days).toBe(7);
  });

  it("resolves a 28 day window ending on today", () => {
    const resolved = resolveRange("28d", "2026-03-31");
    expect(resolved.current).toEqual({
      start: "2026-03-04",
      end: "2026-03-31",
    });
  });

  it("resolves a 90 day window ending on today", () => {
    const resolved = resolveRange("90d", "2026-03-31");
    expect(resolved.current.start).toBe("2026-01-01");
    expect(resolved.days).toBe(90);
  });

  it("places the comparison window immediately before the current window", () => {
    const resolved = resolveRange("7d", "2026-03-10");
    expect(resolved.previous).toEqual({
      start: "2026-02-25",
      end: "2026-03-03",
    });
    expect(resolved.previous.end).toBe(
      addDays(resolved.current.start, -1),
    );
  });

  it("gives the comparison window the same length as the current window", () => {
    for (const preset of ["7d", "28d", "90d"] as const) {
      const resolved = resolveRange(preset, "2026-06-15");
      expect(
        diffDaysInclusive(
          resolved.previous.start,
          resolved.previous.end,
        ),
      ).toBe(resolved.days);
    }
  });

  it("crosses a month boundary correctly", () => {
    const resolved = resolveRange("7d", "2026-03-02");
    expect(resolved.current).toEqual({
      start: "2026-02-24",
      end: "2026-03-02",
    });
  });

  it("crosses a year boundary correctly", () => {
    const resolved = resolveRange("7d", "2026-01-03");
    expect(resolved.current).toEqual({
      start: "2025-12-28",
      end: "2026-01-03",
    });
  });

  it("handles a leap day", () => {
    const resolved = resolveRange("28d", "2028-03-01");
    expect(resolved.current.start).toBe("2028-02-03");
    expect(resolved.days).toBe(28);
  });

  it("is unaffected by daylight saving, because it counts calendar days", () => {
    // 2026-03-29 is the European DST change.
    const resolved = resolveRange("7d", "2026-03-29");
    expect(resolved.days).toBe(7);
    expect(resolved.current.start).toBe("2026-03-23");
  });

  it("resolves a custom range and its comparison window", () => {
    const resolved = resolveRange("custom", "2026-05-10", {
      start: "2026-05-01",
      end: "2026-05-07",
    });
    expect(resolved.current).toEqual({
      start: "2026-05-01",
      end: "2026-05-07",
    });
    expect(resolved.previous).toEqual({
      start: "2026-04-24",
      end: "2026-04-30",
    });
  });

  it("rejects a custom range with no dates", () => {
    expect(() => resolveRange("custom", "2026-05-10")).toThrow();
  });

  it("rejects a range that ends before it starts", () => {
    expect(() =>
      resolveRange("custom", "2026-05-10", {
        start: "2026-05-07",
        end: "2026-05-01",
      }),
    ).toThrow();
  });

  it("rejects a range longer than the maximum window", () => {
    expect(() =>
      clampRange(
        { start: "2024-01-01", end: "2026-01-01", preset: "custom" },
        400,
      ),
    ).toThrow();
  });
});

describe("iso day validation", () => {
  it("rejects a malformed date", () => {
    expect(() => assertIsoDay("10-03-2026")).toThrow();
  });

  it("rejects a date that does not exist", () => {
    expect(() => assertIsoDay("2026-02-31")).toThrow();
  });

  it("accepts a real leap day", () => {
    expect(assertIsoDay("2028-02-29")).toBe("2028-02-29");
  });
});

describe("eachDay", () => {
  it("returns every day in an inclusive range", () => {
    expect(eachDay("2026-03-01", "2026-03-05")).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
  });
});

describe("reporting lag", () => {
  it("knows that a day is not yet reportable for a lagging provider", () => {
    const lag = REPORTING_LAG.searchConsole;
    expect(isDayReportable("2026-03-10", "2026-03-10", lag)).toBe(false);
    expect(isDayReportable("2026-03-08", "2026-03-10", lag)).toBe(false);
    expect(isDayReportable("2026-03-07", "2026-03-10", lag)).toBe(true);
  });
  it("knows that yesterday is reportable for GA4", () => {
    const lag = REPORTING_LAG.ga4;
    expect(isDayReportable("2026-03-09", "2026-03-10", lag)).toBe(true);
    expect(isDayReportable("2026-03-10", "2026-03-10", lag)).toBe(false);
  });

  it("computes the first available day", () => {
    // Search Console is three days behind, so the most recent day it has
    // reported for 10 March is 7 March.
    expect(firstAvailableDay("2026-03-10", REPORTING_LAG.searchConsole)).toBe(
      "2026-03-07",
    );
    expect(firstAvailableDay("2026-03-10", REPORTING_LAG.ga4)).toBe(
      "2026-03-09",
    );
  });
});
