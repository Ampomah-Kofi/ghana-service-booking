import { describe, expect, it, vi } from "vitest";
import { toAppError } from "@/server/businesses/errors";
import { detectImageKind } from "@/server/businesses/media";

describe("toAppError", () => {
  it("maps our SQLSTATE codes and keeps the user-facing message", () => {
    const error = toAppError({ code: "BZ422", message: "not ready to publish", details: "location,contact" });
    expect(error).toMatchObject({
      code: "VALIDATION",
      status: 422,
      message: "Not ready to publish.",
      detail: "location,contact",
    });
    expect(toAppError({ code: "BZ409", message: "that web address is taken" })).toMatchObject({ code: "CONFLICT" });
    expect(toAppError({ code: "BZ429", message: "you can create at most 5 businesses" })).toMatchObject({
      code: "LIMIT_REACHED",
    });
  });
  it("never leaks unknown database errors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = toAppError({ code: "XX000", message: 'relation "secret_table" does not exist' });
    expect(error).toMatchObject({ code: "INTERNAL", message: "Something went wrong. Please try again." });
    log.mockRestore();
  });
  it("uses a generic message for permission errors", () => {
    expect(toAppError({ code: "42501", message: "new row violates row-level security policy" }).message).toBe(
      "You don't have access to this business.",
    );
  });
});

describe("detectImageKind", () => {
  const bytes = (s: string) => new TextEncoder().encode(s);
  it("recognises WebP and JPEG by magic bytes", () => {
    expect(detectImageKind(bytes("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("webp");
    expect(detectImageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });
  it("rejects anything else, including SVG and PNG", () => {
    expect(detectImageKind(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(detectImageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(detectImageKind(new Uint8Array([]))).toBeNull();
  });
});
