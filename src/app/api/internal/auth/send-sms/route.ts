import { z } from "zod";
import { serverEnv } from "@/server/env";
import { getSmsProvider } from "@/server/notifications/sms";
import { verifyStandardWebhook } from "@/server/webhooks/standard-webhooks";
import { parsePhone } from "@/lib/phone";

/**
 * Supabase Auth "Send SMS" hook (ADR-0004). Supabase calls this with the OTP
 * instead of using a built-in SMS vendor, and we deliver it via SmsProvider.
 * Authenticated by the Standard Webhooks signature, not by a user session.
 */
const payloadSchema = z.object({
  user: z.object({ phone: z.string().min(5) }),
  sms: z.object({ otp: z.string().regex(/^\d{4,10}$/) }),
});

function hookError(httpCode: number, message: string) {
  // Supabase hook error shape: surfaced to the client as the auth error.
  return Response.json({ error: { http_code: httpCode, message } }, { status: httpCode });
}

export async function POST(request: Request): Promise<Response> {
  const env = serverEnv();
  const rawBody = await request.text();

  const verified = verifyStandardWebhook(
    env.SEND_SMS_HOOK_SECRET,
    {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
    },
    rawBody,
  );
  if (!verified.ok) return hookError(401, "Invalid hook signature");

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return hookError(400, "Invalid JSON");
  }
  const payload = payloadSchema.safeParse(json);
  if (!payload.success) return hookError(400, "Invalid payload");

  const phone = parsePhone(payload.data.user.phone, env.DEFAULT_COUNTRY_CODE);
  if (!phone.ok) return hookError(400, "Invalid phone number");

  const result = await getSmsProvider().send({
    to: phone.e164,
    body: `Your verification code is ${payload.data.sms.otp}. Do not share it with anyone.`,
    purpose: "auth.otp",
  });
  if (!result.ok) {
    console.error(`[send-sms hook] provider failed: ${result.error}`);
    return hookError(result.retryable ? 503 : 500, "Could not send SMS. Please try again.");
  }
  return Response.json({});
}
