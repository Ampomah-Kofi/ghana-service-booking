import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";

export type PhoneParseResult =
  { ok: true; e164: string; country: CountryCode | undefined } | { ok: false; reason: "invalid" };

/**
 * Parses user input ("024 123 4567", "+233241234567", "233241234567") into E.164.
 * `defaultCountry` applies only to numbers written without an international prefix.
 * Uses libphonenumber metadata (CLAUDE.md: never regex alone).
 */
export function parsePhone(input: string, defaultCountry: CountryCode): PhoneParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return { ok: false, reason: "invalid" };

  // "233…" typed without "+" is common in Ghana; treat a leading country calling code as international.
  const candidates = [trimmed];
  if (/^\d{11,15}$/.test(trimmed) && !trimmed.startsWith("0")) candidates.push(`+${trimmed}`);

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
    if (parsed?.isValid()) {
      return { ok: true, e164: parsed.number, country: parsed.country };
    }
  }
  return { ok: false, reason: "invalid" };
}

/** Formats an E.164 number for display, e.g. "+233 24 123 4567". */
export function formatPhoneInternational(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** Formats an E.164 number the way people write it at home, e.g. "024 123 4567" (prefills forms). */
export function formatPhoneLocal(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatNational() ?? e164;
}

/** Supabase Auth stores phones without the leading "+". */
export function e164ToAuthPhone(e164: string): string {
  return e164.startsWith("+") ? e164.slice(1) : e164;
}
