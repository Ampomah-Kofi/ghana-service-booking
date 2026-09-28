import { BRAND } from "./brand";
/**
 * Minimal iCalendar (RFC 5545) event for "Add to calendar" (ADR-0012). Pure and dependency-free:
 * phones open the downloaded .ics in their own calendar app. No third-party calendar API.
 */
export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  status: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  /** Minutes before the start for a reminder alarm. */
  alarmMinutes?: number | null;
  now?: Date;
};

const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

/** Escapes TEXT values: backslash, semicolon, comma and newlines. */
export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Folds a content line to 75 octets (UTF-8), continuing with CRLF + space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${BRAND.name}//Bookings//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(event.now ?? new Date())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : null,
    event.description ? `DESCRIPTION:${escapeIcsText(event.description)}` : null,
    event.url ? `URL:${event.url}` : null,
    `STATUS:${event.status}`,
    ...(event.alarmMinutes && event.status !== "CANCELLED"
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `TRIGGER:-PT${Math.round(event.alarmMinutes)}M`,
          `DESCRIPTION:${escapeIcsText(event.summary)}`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
