import { describe, expect, it } from "vitest";
import {
  averageSeries,
  computeBounceRate,
  computeCpa,
  computeCpc,
  computeCtr,
  computeKeyEventRate,
  computeRoas,
  describeChange,
  percentChange,
  reported,
  sumSeries,
  weightedAveragePosition,
} from "@/domain/kpi";

const at = "2026-03-10T00:00:00.000Z";

describe("summing a series", () => {
  it("sums the present values", () => {
    const result = sumSeries([
      reported(10, at),
      reported(20, at),
      reported(12, at),
    ]);
    expect(result.value).toBe(42);
    expect(result.coverage).toBe(1);
    expect(result.missing).toBe(0);
  });

  it("reports coverage when a day has no value", () => {
    const result = sumSeries([reported(10, at), reported(null, at)]);
    expect(result.value).toBe(10);
    expect(result.coverage).toBe(0.5);
    expect(result.missing).toBe(1);
  });

  it("returns null rather than zero when nothing has a value", () => {
    const result = sumSeries([reported(null, at), reported(null, at)]);
    expect(result.value).toBeNull();
    expect(result.coverage).toBe(0);
  });

  it("returns null for an empty series", () => {
    expect(sumSeries([]).value).toBeNull();
  });

  it("marks a derived value as derived", () => {
    const result = sumSeries([
      { value: 5, source: "derived", grain: "day", fetchedAt: at },
    ]);
    expect(result.source).toBe("derived");
  });
});

describe("averaging a series", () => {
  it("averages the present values and reports coverage", () => {
    const result = averageSeries([
      reported(10, at),
      reported(20, at),
      reported(null, at),
    ]);
    expect(result.value).toBe(15);
    expect(result.coverage).toBeCloseTo(2 / 3);
  });
});

describe("weighted average position", () => {
  it("weights position by impressions, like Google reports it", () => {
    const result = weightedAveragePosition([
      { position: 1, impressions: 1 },
      { position: 8, impressions: 10_000 },
    ]);
    // A plain mean would say 4.5. The impression-weighted value is ~8.
    expect(result.value).toBeGreaterThan(7.9);
    expect(result.value).toBeLessThan(8.1);
  });

  it("returns null when there is no impression data", () => {
    expect(
      weightedAveragePosition([{ position: 3, impressions: 0 }]).value,
    ).toBeNull();
  });

  it("returns null when there are no rows", () => {
    expect(weightedAveragePosition([]).value).toBeNull();
  });
});

describe("derived ratios", () => {
  it("computes CTR", () => {
    const ctr = computeCtr(reported(50, at), reported(1000, at));
    expect(ctr?.value).toBe(0.05);
  });

  it("does not fabricate a CTR when impressions are zero", () => {
    const ctr = computeCtr(reported(0, at), reported(0, at));
    expect(ctr?.value).toBe(0);
  });

  it("returns null for CTR when a value is missing", () => {
    expect(computeCtr(reported(null, at), reported(1000, at))).toBeNull();
  });

  it("computes average CPC", () => {
    const cpc = computeCpc(
      { amount: 100, currency: "MAD" },
      reported(50, at),
    );
    expect(cpc?.value).toBe(2);
  });

  it("returns null for CPC when there are no clicks", () => {
    expect(
      computeCpc({ amount: 100, currency: "MAD" }, reported(0, at)),
    ).toBeNull();
  });

  it("computes cost per conversion", () => {
    const cpa = computeCpa(
      { amount: 480, currency: "MAD" },
      reported(48, at),
    );
    expect(cpa?.value).toBe(10);
  });

  it("returns null for CPA when there are no conversions", () => {
    expect(
      computeCpa({ amount: 480, currency: "MAD" }, reported(0, at)),
    ).toBeNull();
  });

  it("computes ROAS", () => {
    const roas = computeRoas(
      { amount: 100, currency: "MAD" },
      { amount: 250, currency: "MAD" },
    );
    expect(roas?.value).toBe(2.5);
  });

  it("returns null for ROAS when there is no conversion value", () => {
    expect(computeRoas({ amount: 100, currency: "MAD" }, null)).toBeNull();
  });

  it("refuses to compute ROAS across mismatched currencies", () => {
    expect(() =>
      computeRoas(
        { amount: 100, currency: "MAD" },
        { amount: 250, currency: "EUR" },
      ),
    ).toThrow(/currenc/i);
  });

  it("computes the key event rate", () => {
    const rate = computeKeyEventRate(reported(25, at), reported(500, at));
    expect(rate?.value).toBe(0.05);
  });

  it("computes the bounce rate", () => {
    const rate = computeBounceRate(reported(300, at), reported(500, at));
    expect(rate?.value).toBeCloseTo(0.4);
  });
});

describe("period over period change", () => {
  it("computes a fractional change", () => {
    expect(percentChange(120, 100)).toBeCloseTo(0.2);
  });

  it("returns null when the previous value is zero", () => {
    expect(percentChange(50, 0)).toBeNull();
  });

  it("returns null when either value is missing", () => {
    expect(percentChange(null, 100)).toBeNull();
    expect(percentChange(100, null)).toBeNull();
  });

  it("describes an upward move", () => {
    const change = describeChange(120, 100);
    expect(change.direction).toBe("up");
    expect(change.ratio).toBeCloseTo(0.2);
  });

  it("describes a downward move", () => {
    expect(describeChange(80, 100).direction).toBe("down");
  });

  it("describes a flat move", () => {
    expect(describeChange(100, 100).direction).toBe("flat");
  });

  it("shows an absolute movement rather than a percentage from zero", () => {
    const change = describeChange(50, 0);
    expect(change.ratio).toBeNull();
    expect(change.magnitudeOnly).toBe(true);
    expect(change.direction).toBe("up");
  });

  it("reports an unknown direction when a value is missing", () => {
    expect(describeChange(null, 100).direction).toBe("unknown");
  });
});
