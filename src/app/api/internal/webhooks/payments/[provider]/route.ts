import { handlePaymentWebhook } from "@/server/jobs/payments";

/**
 * POST /api/internal/webhooks/payments/{provider}: a payment provider tells us a charge was paid, failed or
 * refunded. The signature is checked first; the event is stored and applied exactly once. Internal:
 * not part of /api/v1.
 */
export async function POST(
  request: Request,
  ctx: RouteContext<"/api/internal/webhooks/payments/[provider]">,
): Promise<Response> {
  const { provider } = await ctx.params;
  const rawBody = await request.text();
  if (rawBody.length > 64_000) return Response.json({ error: "too large" }, { status: 413 });
  try {
    const { status, body } = await handlePaymentWebhook(provider, request.headers, rawBody);
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[payments webhook]", error);
    // 500 makes the provider retry later; the event id keeps a retry from double-applying.
    return Response.json({ error: "try again" }, { status: 500 });
  }
}
