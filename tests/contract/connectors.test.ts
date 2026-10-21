import { afterEach, describe, expect, it, vi } from "vitest";
import { Ga4Connector, parseMetricValue } from "@/providers/google/ga4";
import { GscConnector } from "@/providers/google/gsc";
import { GoogleAdsConnector } from "@/providers/google/google-ads";
import { ConnectorError } from "@/providers/connector";

/**
 * Connector contract tests.
 *
 * These run against recorded provider response shapes, not live accounts.
 * They prove the normalisation is correct and that the adapters talk to the
 * documented endpoints with the documented parameters.
 */

function mockFetch(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
) {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GA4 connector", () => {
  const account = {
    externalAccountId: "123456789",
    displayLabel: "medicalbay.ma",
    identifiers: { ga4: { propertyId: "123456789" } },
  };

  it("requests the documented runReport endpoint", async () => {
    const fetchMock = mockFetch({ rows: [] });
    const connector = new Ga4Connector({ baseUrl: "https://data.test" });

    await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07", dimension: "date" },
      { accessToken: "token" },
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://data.test/properties/123456789:runReport",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer token",
    );
  });

  it("normalises the reported dimensions and metrics", async () => {
    mockFetch({
      rows: [
        {
          dimensionValues: [{ value: "20260301" }],
          metricValues: [
            { value: "120" },
            { value: "95" },
            { value: "40" },
            { value: "70" },
            { value: "800" },
            { value: "12" },
            { value: "0" },
          ],
        },
      ],
      metadata: {
        timeZone: "Africa/Casablanca",
        currencyCode: "MAD",
        subjectToThresholding: true,
      },
    });

    const connector = new Ga4Connector({ baseUrl: "https://data.test" });
    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07", dimension: "date" },
      { accessToken: "token" },
    );

    expect(result.facts).toHaveLength(1);
    const fact = result.facts[0]!;
    expect(fact.metricDate).toBe("20260301");
    expect(fact.dimension).toBe("date");
    expect(fact.values.sessions).toBe(120);
    expect(fact.values.active_users).toBe(95);
    expect(fact.values.key_events).toBe(12);
  });

  it("treats an empty metric string as no value rather than zero", () => {
    expect(parseMetricValue("")).toBeNull();
    expect(parseMetricValue(undefined)).toBeNull();
    expect(parseMetricValue("0")).toBe(0);
    expect(parseMetricValue("42.5")).toBe(42.5);
  });

  it("reports the provider's cardinality and thresholding caveats", async () => {
    mockFetch({
      rows: [],
      metadata: { dataLossFromOtherRow: true, subjectToThresholding: true },
    });

    const connector = new Ga4Connector({ baseUrl: "https://data.test" });
    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    expect(result.notes.join(" ")).toMatch(/withheld rows/i);
    expect(result.notes.join(" ")).toMatch(/cardinality/i);
  });

  it("turns a 401 into a non-retryable auth error", async () => {
    mockFetch({ error: { message: "Invalid credentials" } }, { status: 401 });

    const connector = new Ga4Connector({ baseUrl: "https://data.test" });

    await expect(
      connector.readReport(
        account,
        { startDate: "2026-03-01", endDate: "2026-03-07" },
        { accessToken: "bad" },
      ),
    ).rejects.toMatchObject({ code: "auth_failed", retryable: false });
  });

  it("turns a 429 into a retryable rate-limit error", async () => {
    mockFetch({}, { status: 429, headers: { "Retry-After": "120" } });

    const connector = new Ga4Connector({ baseUrl: "https://data.test" });

    await expect(
      connector.readReport(
        account,
        { startDate: "2026-03-01", endDate: "2026-03-07" },
        { accessToken: "token" },
      ),
    ).rejects.toMatchObject({ code: "rate_limited", retryable: true });
  });

  it("turns a 5xx into a retryable unavailable error", async () => {
    mockFetch({}, { status: 503 });

    const connector = new Ga4Connector({ baseUrl: "https://data.test" });

    await expect(
      connector.readReport(
        account,
        { startDate: "2026-03-01", endDate: "2026-03-07" },
        { accessToken: "token" },
      ),
    ).rejects.toMatchObject({ code: "provider_unavailable", retryable: true });
  });

  it("refuses to run a report for an account with no property id", async () => {
    const connector = new Ga4Connector({ baseUrl: "https://data.test" });

    await expect(
      connector.readReport(
        {
          externalAccountId: "",
          displayLabel: "no property",
          identifiers: {},
        },
        { startDate: "2026-03-01", endDate: "2026-03-07" },
        { accessToken: "token" },
      ),
    ).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe("Search Console connector", () => {
  const account = {
    externalAccountId: "sc-domain:medicalbay.ma",
    displayLabel: "medicalbay.ma",
    identifiers: { gsc: { propertyUrl: "sc-domain:medicalbay.ma" } },
  };

  it("requests the documented searchAnalytics endpoint", async () => {
    const fetchMock = mockFetch({ rows: [] });
    const connector = new GscConnector({ baseUrl: "https://gsc.test" });

    await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07", dimension: "query" },
      { accessToken: "token" },
    );

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://gsc.test/sites/sc-domain%3Amedicalbay.ma/searchAnalytics/query",
    );
    expect(init.method).toBe("POST");
  });

  it("normalises clicks, impressions, ctr and position", async () => {
    mockFetch({
      rows: [
        {
          keys: ["dentiste esthetique agadir"],
          clicks: 120,
          impressions: 3400,
          ctr: 0.035294,
          position: 8.4,
        },
      ],
    });

    const connector = new GscConnector({ baseUrl: "https://gsc.test" });
    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07", dimension: "query" },
      { accessToken: "token" },
    );

    const fact = result.facts[0]!;
    expect(fact.values.clicks).toBe(120);
    expect(fact.values.impressions).toBe(3400);
    expect(fact.values.position).toBe(8.4);
    expect(fact.dimensionLabel).toBe("dentiste esthetique agadir");
  });

  it("always states that the endpoint returns aggregated rows", async () => {
    mockFetch({ rows: [] });
    const connector = new GscConnector({ baseUrl: "https://gsc.test" });

    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    expect(result.notes.join(" ")).toMatch(/aggregated rows/i);
    expect(result.notes.join(" ")).toMatch(/does not return every query/i);
  });

  it("reports a partial view when the row limit was reached", async () => {
    mockFetch({
      rows: Array.from({ length: 5 }, (_, index) => ({
        keys: [`query-${index}`],
        clicks: 1,
        impressions: 2,
        ctr: 0.5,
        position: 3,
      })),
    });

    const connector = new GscConnector({ baseUrl: "https://gsc.test" });
    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07", limit: 5 },
      { accessToken: "token" },
    );

    expect(result.truncated).toBe(true);
    expect(result.notes.join(" ")).toMatch(/row limit/i);
  });
});

describe("Google Ads connector", () => {
  const account = {
    externalAccountId: "456-789-1234",
    displayLabel: "Medical Bay Ads",
    identifiers: { google_ads: { customerId: "456-789-1234" } },
  };

  it("sends no developer-token header, because the token was sunset", async () => {
    const fetchMock = mockFetch({ results: [] });
    const connector = new GoogleAdsConnector({ baseUrl: "https://ads.test" });

    await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["developer-token"]).toBeUndefined();
    expect(headers.Authorization).toBe("Bearer token");
  });

  it("sends the manager account id when one is configured", async () => {
    const fetchMock = mockFetch({ results: [] });
    const connector = new GoogleAdsConnector({
      baseUrl: "https://ads.test",
      loginCustomerId: "999-888-7777",
    });

    await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["login-customer-id"]).toBe(
      "9998887777",
    );
  });

  it("builds a GAQL query bounded by the requested dates", async () => {
    const fetchMock = mockFetch({ results: [] });
    const connector = new GoogleAdsConnector({ baseUrl: "https://ads.test" });

    await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { query: string };
    expect(body.query).toContain(
      "segments.date BETWEEN '2026-03-01' AND '2026-03-07'",
    );
    expect(body.query).toContain("metrics.cost_micros");
  });

  it("normalises micros, conversions and conversion value", async () => {
    mockFetch({
      results: [
        {
          campaign: { id: "111", name: "Dentistry — Agadir" },
          segments: { date: "2026-03-01" },
          metrics: {
            impressions: "1000",
            clicks: "42",
            costMicros: "248000000",
            conversions: "5",
            conversionsValue: "620000000",
          },
        },
      ],
    });

    const connector = new GoogleAdsConnector({ baseUrl: "https://ads.test" });
    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    const fact = result.facts[0]!;
    expect(fact.values.impressions).toBe(1000);
    expect(fact.values.cost_micros).toBe(248_000_000);
    expect(fact.values.conversions).toBe(5);
    expect(fact.values.conversion_value_micros).toBe(620_000_000);
    expect(fact.dimensionLabel).toBe("Dentistry — Agadir");
  });

  it("states that Ads conversions are not comparable with GA4 key events", async () => {
    mockFetch({ results: [] });
    const connector = new GoogleAdsConnector({ baseUrl: "https://ads.test" });

    const result = await connector.readReport(
      account,
      { startDate: "2026-03-01", endDate: "2026-03-07" },
      { accessToken: "token" },
    );

    expect(result.notes.join(" ")).toMatch(/not comparable with GA4/i);
  });
});
