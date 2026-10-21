import { describe, expect, it } from "vitest";
import {
  amountToMicros,
  amountToMinor,
  convertCurrency,
  formatMoney,
  formatPercent,
  formatRatio,
  microsToAmount,
  minorToAmount,
  sumMoney,
  sumMoneyConverted,
} from "@/domain/currency";

describe("currency conversion", () => {
  it("converts Google Ads micros to a decimal amount", () => {
    expect(microsToAmount(2_480_000_000, "MAD")).toBe(2480);
    expect(microsToAmount(1_500_000, "USD")).toBe(1.5);
  });

  it("converts a decimal amount back to micros", () => {
    expect(amountToMicros(2480)).toBe(2_480_000_000);
    expect(amountToMicros(1.5)).toBe(1_500_000);
  });

  it("rounds rather than truncating when converting to micros", () => {
    expect(amountToMicros(0.0000015)).toBe(2);
  });

  it("handles a currency with no minor unit", () => {
    expect(minorToAmount(500, "JPY")).toBe(500);
    expect(amountToMinor(500, "JPY")).toBe(500);
  });

  it("converts minor units for a two-decimal currency", () => {
    expect(minorToAmount(248050, "MAD")).toBe(2480.5);
  });
});

describe("summing money", () => {
  it("sums amounts that share a currency", () => {
    const total = sumMoney([
      { amount: 100, currency: "MAD" },
      { amount: 250.5, currency: "MAD" },
    ]);
    expect(total).toEqual({ amount: 350.5, currency: "MAD" });
  });

  it("returns null for an empty list", () => {
    expect(sumMoney([])).toBeNull();
  });

  it("refuses to sum mixed currencies rather than producing a misleading total", () => {
    expect(() =>
      sumMoney([
        { amount: 100, currency: "MAD" },
        { amount: 10, currency: "EUR" },
      ]),
    ).toThrow(/mixed currencies/i);
  });

  it("converts with an explicit dated rate", () => {
    const converted = convertCurrency(
      { amount: 100, currency: "EUR" },
      {
        from: "EUR",
        to: "MAD",
        rate: 11.5,
        asOf: "2026-03-10",
        source: "ecb",
      },
    );
    expect(converted).toEqual({ amount: 1150, currency: "MAD" });
  });

  it("refuses a conversion whose source currency does not match", () => {
    expect(() =>
      convertCurrency(
        { amount: 100, currency: "USD" },
        {
          from: "EUR",
          to: "MAD",
          rate: 11.5,
          asOf: "2026-03-10",
          source: "ecb",
        },
      ),
    ).toThrow();
  });

  it("reports currencies it could not convert instead of hiding them", () => {
    const result = sumMoneyConverted(
      [
        { amount: 100, currency: "MAD" },
        { amount: 10, currency: "EUR" },
        { amount: 5, currency: "GBP" },
      ],
      {
        EUR: {
          from: "EUR",
          to: "MAD",
          rate: 11.5,
          asOf: "2026-03-10",
          source: "ecb",
        },
      },
      "MAD",
    );

    expect(result.convertedCount).toBe(2);
    expect(result.skippedCurrencies).toEqual(["GBP"]);
    expect(result.total.amount).toBe(100 + 115);
  });
});

describe("formatting", () => {
  it("formats money with the currency", () => {
    expect(formatMoney({ amount: 2480, currency: "MAD" })).toContain("2,480");
  });

  it("renders an unavailable value as an em dash, never zero", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("formats a percentage", () => {
    expect(formatPercent(0.1234)).toBe("12.3%");
    expect(formatPercent(null)).toBe("—");
  });

  it("formats a ratio", () => {
    expect(formatRatio(2.4)).toBe("2.40x");
    expect(formatRatio(null)).toBe("—");
  });
});
