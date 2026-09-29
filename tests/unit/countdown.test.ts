import { describe, expect, it } from "vitest";
import { countdownLabel } from "@/lib/countdown";

describe("countdownLabel", () => {
  const now = new Date("2026-09-28T09:00:00Z");
  const at = (min: number) => new Date(now.getTime() + min * 60_000);
  it("counts down in minutes, then hours", () => {
    expect(countdownLabel(at(25), now)).toBe("Up next · in 25 min");
    expect(countdownLabel(at(60), now)).toBe("Up next · in 1 hr");
    expect(countdownLabel(at(95), now)).toBe("Up next · in 1 hr 35 min");
  });
  it("says it's happening once the start has passed", () => {
    expect(countdownLabel(at(0), now)).toBe("Happening now");
    expect(countdownLabel(at(-5), now)).toBe("Happening now");
  });
});

describe("countdownShort / progressThrough", () => {
  const start = new Date("2026-09-28T10:00:00Z");
  const end = new Date("2026-09-28T10:45:00Z");
  const t = (iso: string) => new Date(`2026-09-28T${iso}Z`);
  it("counts down, then shows time left, then running over", async () => {
    const { countdownShort } = await import("@/lib/countdown");
    expect(countdownShort(start, end, t("09:35:00"))).toBe("in 25 min");
    expect(countdownShort(start, end, t("08:55:00"))).toBe("in 1 hr 5 min");
    expect(countdownShort(start, end, t("10:25:00"))).toBe("20 min left");
    expect(countdownShort(start, end, t("10:50:00"))).toBe("Running over");
  });
  it("progress is 0 before, a fraction during, 1 after", async () => {
    const { progressThrough } = await import("@/lib/countdown");
    expect(progressThrough(start, end, t("09:00:00"))).toBe(0);
    expect(progressThrough(start, end, t("10:15:00"))).toBeCloseTo(1 / 3);
    expect(progressThrough(start, end, t("11:00:00"))).toBe(1);
  });
});
