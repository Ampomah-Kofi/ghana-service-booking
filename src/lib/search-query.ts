/**
 * Splits a free-text marketplace query into "what" and "where".
 *   "Barber in East Legon" → { what: "Barber", where: "East Legon" }
 *   "Nails near me"        → { what: "Nails", nearMe: true }
 *   "Massage"              → { what: "Massage" }
 * Pure and shared by the web search page and /api/v1/search.
 */
export type ParsedQuery = { what: string; where: string; nearMe: boolean };

const NEAR_ME = /\b(near me|nearby|close to me|around me|near here)\b/gi;
const PLACE_SPLIT = /\s+(?:in|at|around|near)\s+(?!me\b)/gi;

export function parseSearchQuery(raw: string): ParsedQuery {
  let text = raw.replace(/\s+/g, " ").trim().slice(0, 100);
  const nearMe = NEAR_ME.test(text);
  NEAR_ME.lastIndex = 0;
  text = text.replace(NEAR_ME, " ").replace(/\s+/g, " ").trim();

  // "in Accra" on its own: only a place.
  const leading = /^(?:in|at|around)\s+(.+)$/i.exec(text);
  if (leading && !/^me\b/i.test(leading[1])) return { what: "", where: leading[1].trim(), nearMe };

  // Split on the LAST " in "/" at " so names like "Cuts in Style in Osu" keep their first part.
  let splitAt = -1;
  let splitLength = 0;
  for (const match of text.matchAll(PLACE_SPLIT)) {
    splitAt = match.index ?? -1;
    splitLength = match[0].length;
  }
  if (splitAt > 0) {
    return { what: text.slice(0, splitAt).trim(), where: text.slice(splitAt + splitLength).trim(), nearMe };
  }
  return { what: text, where: "", nearMe };
}

/** "5.6037,-0.1870" → coordinates, or null if malformed/out of range. */
export function parseCoordinates(value: string | null | undefined): { lat: number; lng: number } | null {
  if (!value) return null;
  const match = /^(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/.exec(value.trim());
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat: Number(lat.toFixed(4)), lng: Number(lng.toFixed(4)) }
    : null;
}
