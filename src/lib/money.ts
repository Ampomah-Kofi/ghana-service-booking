/**
 * Money is always an integer amount of minor units (e.g. pesewas) plus an
 * ISO 4217 currency code. Never floats (CLAUDE.md §Conventions).
 */
export type Money = { amountMinor: number; currency: string };

export type CurrencyInfo = { code: string; minorUnit: number; symbol?: string };

export function assertMinorUnits(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`amountMinor must be a safe integer, got ${amountMinor}`);
  }
}

/**
 * Formats minor units for display. `currency.symbol` overrides the locale's
 * symbol (e.g. "GH₵" instead of "GHS"), because the currency table is data.
 */
export function formatMoney(money: Money, currency: CurrencyInfo, locale = "en-GH"): string {
  assertMinorUnits(money.amountMinor);
  if (money.currency !== currency.code) {
    throw new Error(`currency mismatch: ${money.currency} vs ${currency.code}`);
  }
  const major = money.amountMinor / 10 ** currency.minorUnit;
  const hasFraction = money.amountMinor % 10 ** currency.minorUnit !== 0;
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    currencyDisplay: "code",
    minimumFractionDigits: hasFraction ? currency.minorUnit : 0,
    maximumFractionDigits: currency.minorUnit,
  });
  const parts = formatter.formatToParts(major);
  const symbol = currency.symbol ?? currency.code;
  const sign = parts.some((p) => p.type === "minusSign") ? "-" : "";
  const number = parts
    .filter((p) => p.type === "integer" || p.type === "group" || p.type === "decimal" || p.type === "fraction")
    .map((p) => p.value)
    .join("");
  return `${sign}${symbol}${number}`;
}
