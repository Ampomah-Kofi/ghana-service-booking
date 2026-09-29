import { describe, expect, it } from "vitest";
import { safeReturnPath } from "@/lib/safe-return-path";

describe("safeReturnPath", () => {
  it.each(["/account", "/business/kwame-cuts?tab=services", "/"])("allows relative path %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });
  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/ok\n//evil",
  ])("falls back for %j", (path) => {
    expect(safeReturnPath(path)).toBe("/account");
  });
});
