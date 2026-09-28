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
