import { checkCronAuth } from "@/server/jobs/auth";
import { runPaymentJobs } from "@/server/jobs/payments";

/**
 * POST /api/internal/jobs/payments: releases expired deposit holds, reconciles stuck payments and
 * sends queued refunds. Same caller and secret as the notification dispatcher. Not part of the public API.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  try {
    const result = await runPaymentJobs();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[payments job]", error);
    return Response.json({ error: "payments job failed" }, { status: 500 });
  }
}
