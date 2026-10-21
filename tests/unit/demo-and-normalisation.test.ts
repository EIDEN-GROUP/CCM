import { describe, expect, it } from "vitest";
import {
  demoAdsRows,
  demoGa4Rows,
  demoGscRows,
  isDemoMode,
} from "@/lib/demo/fixtures";
import { toAdsFact, toGa4Fact, toGscFact } from "@/lib/providers/upsert";
import { collectMeasurementIds } from "@/providers/google/gtm";

describe("demo fixtures", () => {
  it("are off unless demo mode is explicitly enabled", () => {
    expect(isDemoMode()).toBe(false);
  });

  it("are deterministic, so a screenshot taken twice looks the same", () => {
    const first = demoAdsRows("2026-03-01", "2026-03-28");
    const second = demoAdsRows("2026-03-01", "2026-03-28");
    expect(first).toEqual(second);
  });

  it("only cover the requested window", () => {
    const rows = demoAdsRows("2026-03-20", "2026-03-28");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.metric_date >= "2026-03-20").toBe(true);
      expect(row.metric_date <= "2026-03-28").toBe(true);
    }
  });

  it("produce plausible magnitudes rather than absurd ones", () => {
    const rows = demoGa4Rows("2026-03-01", "2026-03-28");
    for (const row of rows) {
      expect(row.sessions!).toBeGreaterThan(0);
      expect(row.sessions!).toBeLessThan(100_000);
    }
  });

  it("produce a Search Console series with positions", () => {
    const rows = demoGscRows("2026-03-01", "2026-03-28");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.position!).toBeGreaterThan(0);
      expect(row.impressions!).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("normalising connector facts", () => {
  const context = { workspaceId: "ws", accountId: "acc", currency: "MAD" };

  it("maps an ads fact", () => {
    const fact = toAdsFact(
      {
        metricDate: "2026-03-01",
        dimension: "campaign",
        dimensionId: "c1",
        dimensionLabel: "Dentistry",
        values: {
          impressions: 1000,
          clicks: 42,
          cost_micros: 248_000_000,
          conversions: 5,
          conversion_value_micros: 620_000_000,
        },
        sourceFetchedAt: "2026-03-02T00:00:00.000Z",
      },
      context,
    );

    expect(fact).not.toBeNull();
    expect(fact!.impressions).toBe(1000);
    expect(fact!.cost_micros).toBe(248_000_000);
    expect(fact!.currency).toBe("MAD");
  });

  it("maps a GA4 fact", () => {
    const fact = toGa4Fact(
      {
        metricDate: "2026-03-01",
        dimension: "ga4",
        dimensionId: "total",
        dimensionLabel: null,
        values: { sessions: 120, key_events: 7 },
        sourceFetchedAt: "2026-03-02T00:00:00.000Z",
      },
      { workspaceId: "ws", accountId: "acc" },
    );

    expect(fact!.sessions).toBe(120);
    expect(fact!.key_events).toBe(7);
  });

  it("maps a Search Console fact", () => {
    const fact = toGscFact(
      {
        metricDate: "2026-03-01",
        dimension: "gsc",
        dimensionId: "dentiste agadir",
        dimensionLabel: "dentiste agadir",
        values: { clicks: 20, impressions: 500, position: 7.5 },
        sourceFetchedAt: "2026-03-02T00:00:00.000Z",
      },
      { workspaceId: "ws", accountId: "acc" },
    );

    expect(fact!.clicks).toBe(20);
    expect(fact!.position).toBe(7.5);
  });

  it("keeps a missing value null rather than turning it into zero", () => {
    const fact = toGa4Fact(
      {
        metricDate: "2026-03-01",
        dimension: "ga4",
        dimensionId: "total",
        dimensionLabel: null,
        values: { sessions: 120, key_events: null },
        sourceFetchedAt: "2026-03-02T00:00:00.000Z",
      },
      { workspaceId: "ws", accountId: "acc" },
    );

    expect(fact!.key_events).toBeNull();
  });
});

describe("discovering the GA4 measurement id in a GTM container", () => {
  it("finds the measurement id in a GA4 configuration tag", () => {
    const ids = collectMeasurementIds([
      {
        type: "gaawe",
        parameter: [
          { type: "template", value: "G-ABC123XYZ" },
          { type: "template", value: "measurementId" },
        ],
      },
    ]);
    expect(ids).toEqual(["G-ABC123XYZ"]);
  });

  it("finds a measurement id nested anywhere in the tag list", () => {
    const ids = collectMeasurementIds([
      { tag: [{ value: "G-ONE11111" }] },
      { tag: [{ value: "G-TWO22222" }] },
    ]);
    expect(ids).toEqual(["G-ONE11111", "G-TWO22222"]);
  });

  it("returns nothing when the container has no GA4 tag", () => {
    expect(collectMeasurementIds([{ type: "html", parameter: [] }])).toEqual([]);
  });
});
