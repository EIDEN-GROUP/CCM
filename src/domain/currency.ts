/**
 * Currency handling.
 *
 * Google Ads reports money as integer *micros* (1/1,000,000 of the account
 * currency). GA4 reports minor units (cents). Everything CCM stores is a
 * decimal amount in the account's native currency plus the currency code.
 *
 * Portfolio totals are only computed when every contributing account shares
 * the same currency, unless an explicit exchange rate (with its own date)
 * is supplied. We never silently sum mixed currencies.
 */

export interface Money {
  /** Decimal amount in `currency`. */
  amount: number;
  /** ISO 4217 code, uppercase. */
  currency: string;
}

export const SUPPORTED_CURRENCIES = [
  "MAD",
  "EUR",
  "USD",
  "GBP",
  "CAD",
  "AED",
  "TRY",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Number of minor units per major unit for currencies CCM understands. */
const MINOR_UNITS: Record<string, number> = {
  MAD: 2,
  EUR: 2,
  USD: 2,
  GBP: 2,
  CAD: 2,
  AED: 2,
  TRY: 2,
  // JPY has no minor unit.
  JPY: 0,
};

export function minorUnitFactor(currency: string): number {
  const factor = MINOR_UNITS[currency.toUpperCase()];
  if (factor === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return 10 ** factor;
}

/**
 * Convert Google Ads micros to a decimal amount.
 *
 * Micros are always one millionth of the account's currency unit, so the
 * conversion is currency-independent. The currency parameter is kept so the
 * call site reads consistently with the other money helpers and so a future
 * currency with a different subdivision can be handled in one place.
 */
export function microsToAmount(micros: number, _currency?: string): number {
  return micros / 1_000_000;
}

/** Convert a decimal amount to Google Ads micros (rounded, never truncated). */
export function amountToMicros(amount: number): number {
  return Math.round(amount * 1_000_000);
}

/** Convert minor units (cents) to a decimal amount. */
export function minorToAmount(minor: number, currency: string): number {
  return minor / minorUnitFactor(currency);
}

/** Convert a decimal amount to minor units. */
export function amountToMinor(amount: number, currency: string): number {
  return Math.round(amount * minorUnitFactor(currency));
}

export function isSameCurrency(a: Money, b: Money): boolean {
  return a.currency.toUpperCase() === b.currency.toUpperCase();
}

/**
 * Sum amounts that share a currency.
 *
 * Throws rather than returning a misleading total when currencies differ.
 * Callers that genuinely want a portfolio total must convert first, using
 * `convertCurrency` with a dated rate, and must label the result.
 */
export function sumMoney(values: Money[]): Money | null {
  if (values.length === 0) return null;
  const currency = values[0]!.currency.toUpperCase();
  let total = 0;
  for (const value of values) {
    if (!isSameCurrency(value, { amount: 0, currency })) {
      throw new Error(
        `Cannot sum mixed currencies (${currency} and ${value.currency}). Convert with an explicit, dated rate first.`,
      );
    }
    total += value.amount;
  }
  return { amount: roundCurrency(total), currency };
}

export interface ExchangeRate {
  from: string;
  to: string;
  /** Units of `to` per 1 unit of `from`. */
  rate: number;
  /** ISO day the rate was observed. Required — rates go stale. */
  asOf: string;
  source: string;
}

/**
 * Convert money using an explicit, dated rate.
 *
 * The rate's provenance travels with the result so a UI can show it.
 */
export function convertCurrency(money: Money, rate: ExchangeRate): Money {
  if (money.currency.toUpperCase() === rate.to.toUpperCase()) return money;
  if (money.currency.toUpperCase() !== rate.from.toUpperCase()) {
    throw new Error(
      `Exchange rate is ${rate.from}->${rate.to} but amount is in ${money.currency}`,
    );
  }
  return {
    amount: roundCurrency(money.amount * rate.rate),
    currency: rate.to.toUpperCase(),
  };
}

/**
 * Sum mixed currencies by converting each with its own rate.
 *
 * `rates` is keyed by the *source* currency. Any currency without a rate is
 * skipped and reported back so the caller can mark the total as incomplete
 * rather than present it as complete.
 */
export function sumMoneyConverted(
  values: Money[],
  rates: Record<string, ExchangeRate>,
  targetCurrency: string,
): { total: Money; convertedCount: number; skippedCurrencies: string[] } {
  const target = targetCurrency.toUpperCase();
  const skipped = new Set<string>();
  let total = 0;
  let convertedCount = 0;

  for (const value of values) {
    const source = value.currency.toUpperCase();
    if (source === target) {
      total += value.amount;
      convertedCount += 1;
      continue;
    }
    const rate = rates[source];
    if (!rate) {
      skipped.add(source);
      continue;
    }
    total += convertCurrency(value, rate).amount;
    convertedCount += 1;
  }

  return {
    total: { amount: roundCurrency(total), currency: target },
    convertedCount,
    skippedCurrencies: [...skipped],
  };
}

/** Round to the currency's minor unit precision, avoiding float drift. */
export function roundCurrency(amount: number, currency = "USD"): number {
  const factor = minorUnitFactor(currency);
  return Math.round((amount + Number.EPSILON) * factor) / factor;
}

/** Format for display, e.g. "$2,480" / "2 480,00 MAD". */
export function formatMoney(
  money: Money | null | undefined,
  locale = "en-GB",
  options: { compact?: boolean; showCurrency?: boolean } = {},
): string {
  if (!money) return "—";
  const { compact = false, showCurrency = true } = options;
  const value = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: compact ? 0 : 2,
  }).format(money.amount);
  return showCurrency ? value : value.replace(/[^\d.,\s-]/g, "");
}

/** Format a ratio as a percentage, e.g. 0.1234 -> "12.34%". */
export function formatPercent(
  ratio: number | null | undefined,
  locale = "en-GB",
  digits = 1,
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio);
}

/** Format a ratio as a multiple, e.g. 2.4 -> "2.4x". */
export function formatRatio(
  ratio: number | null | undefined,
  locale = "en-GB",
  digits = 2,
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(ratio)}x`;
}
