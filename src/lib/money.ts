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

/**
 * Parses what a person types into a price box ("50", "50.5", "1,200.00", "GH₵ 80")
 * into integer minor units. Returns null for anything that isn't a clean amount.
 */
export function parseMoneyInput(input: string, minorUnit: number): number | null {
  // Drop a leading currency label ("GH₵ ", "GHS"), spaces and thousands separators; anything else must be digits.
  const cleaned = input
    .trim()
    .replace(/^[^\d-]*/, "")
    .replace(/[\s,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  if (fraction.length > minorUnit) return null;
  const minor = Number(whole) * 10 ** minorUnit + Number(fraction.padEnd(minorUnit, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Minor units → plain editable text ("5000" pesewas → "50", "5050" → "50.50"). */
export function minorToInput(amountMinor: number, minorUnit: number): string {
  const factor = 10 ** minorUnit;
  const whole = Math.trunc(amountMinor / factor);
  const fraction = amountMinor % factor;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(minorUnit, "0")}`;
}
