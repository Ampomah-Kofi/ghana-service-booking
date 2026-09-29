import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, foldIcsLine } from "@/lib/ics";

describe("ics", () => {
  const base = {
    uid: "abc@hyia",
    start: new Date("2026-10-14T09:30:00Z"),
    end: new Date("2026-10-14T10:15:00Z"),
    summary: "Skin fade · Kwame Cuts",
    status: "CONFIRMED" as const,
    now: new Date("2026-09-28T12:00:00.123Z"),
  };

  it("writes UTC times, CRLF line endings and a reminder", () => {
    const ics = buildIcs({ ...base, alarmMinutes: 60, location: "East Legon, Accra" });
    expect(ics).toContain("DTSTART:20261014T093000Z\r\n");
    expect(ics).toContain("DTEND:20261014T101500Z\r\n");
    expect(ics).toContain("DTSTAMP:20260928T120000Z\r\n");
    expect(ics).toContain("LOCATION:East Legon\\, Accra\r\n");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
  });

  it("leaves out the alarm on a cancelled booking", () => {
    expect(buildIcs({ ...base, status: "CANCELLED", alarmMinutes: 60 })).not.toContain("VALARM");
  });

  it("escapes text", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe("a\;b\\,c\\\\d\\ne");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const line = `DESCRIPTION:${"GH₵ ".repeat(40)}`;
    const folded = foldIcsLine(line);
    const enc = new TextEncoder();
    for (const part of folded.split("\r\n")) expect(enc.encode(part).length).toBeLessThanOrEqual(75);
    expect(
      folded
        .split("\r\n")
        .map((p, i) => (i === 0 ? p : p.slice(1)))
        .join(""),
    ).toBe(line);
  });
});
