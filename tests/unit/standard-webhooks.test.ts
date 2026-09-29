import { describe, expect, it } from "vitest";
import { signStandardWebhook, verifyStandardWebhook } from "@/server/webhooks/standard-webhooks";

const secret = `v1,whsec_${Buffer.from("test-secret-key-0123456789abcdef").toString("base64")}`;
const body = JSON.stringify({ user: { phone: "233241234567" }, sms: { otp: "123456" } });
const now = 1_790_000_000;

function headersFor(id: string, ts: number, raw: string, key = secret) {
  return { id, timestamp: String(ts), signature: `v1,${signStandardWebhook(key, id, ts, raw)}` };
}

describe("verifyStandardWebhook", () => {
  it("accepts a valid signature", () => {
    expect(verifyStandardWebhook(secret, headersFor("msg_1", now, body), body, now)).toEqual({ ok: true });
  });
  it("accepts when one of several signatures matches (key rotation)", () => {
    const h = headersFor("msg_1", now, body);
    expect(verifyStandardWebhook(secret, { ...h, signature: `v1,AAAA ${h.signature}` }, body, now)).toEqual({
      ok: true,
    });
  });
  it("rejects a tampered body", () => {
    expect(
      verifyStandardWebhook(secret, headersFor("msg_1", now, body), body.replace("123456", "000000"), now),
    ).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
  it("rejects a signature made with another secret", () => {
    const other = `v1,whsec_${Buffer.from("another-secret").toString("base64")}`;
    expect(verifyStandardWebhook(secret, headersFor("msg_1", now, body, other), body, now).ok).toBe(false);
  });
  it("rejects stale or future timestamps (replay protection)", () => {
    expect(verifyStandardWebhook(secret, headersFor("msg_1", now - 301, body), body, now)).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
    expect(verifyStandardWebhook(secret, headersFor("msg_1", now + 301, body), body, now)).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
  });
  it("rejects missing headers", () => {
    expect(verifyStandardWebhook(secret, { id: null, timestamp: String(now), signature: "v1,x" }, body, now)).toEqual({
      ok: false,
      reason: "missing_headers",
    });
  });
});
