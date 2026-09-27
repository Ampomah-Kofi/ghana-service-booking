import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Standard Webhooks signature (https://www.standardwebhooks.com/),
 * the scheme Supabase Auth hooks use.
 *   signed content = `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   signature      = base64(HMAC-SHA256(base64decode(secret without "v1,whsec_"), content))
 *   header         = space-separated list of "v1,<signature>"
 */
export type WebhookHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export type VerifyResult =
  { ok: true } | { ok: false; reason: "missing_headers" | "stale_timestamp" | "bad_signature" };

const TOLERANCE_SECONDS = 5 * 60;

export function signStandardWebhook(secret: string, id: string, timestamp: number, rawBody: string): string {
  const key = Buffer.from(secret.replace(/^v1,whsec_/, ""), "base64");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
}

export function verifyStandardWebhook(
  secret: string,
  headers: WebhookHeaders,
  rawBody: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return { ok: false, reason: "missing_headers" };

  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const expected = Buffer.from(signStandardWebhook(secret, id, ts, rawBody));
  for (const part of signature.split(" ")) {
    const [version, value] = part.split(",", 2);
    if (version !== "v1" || !value) continue;
    const candidate = Buffer.from(value);
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return { ok: true };
  }
  return { ok: false, reason: "bad_signature" };
}
