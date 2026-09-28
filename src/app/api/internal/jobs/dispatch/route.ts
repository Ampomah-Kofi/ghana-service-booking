import { checkCronAuth } from "@/server/jobs/auth";
import { dispatchDueNotifications } from "@/server/jobs/dispatch";

/**
 * POST /api/internal/jobs/dispatch: sends due notifications. Called every minute by pg_cron + pg_net
 * (hosted) or scripts/dev/dispatch-loop.mjs (local) with `Authorization: Bearer <CRON_SECRET>`.
 * Not part of the public API.
 */
export async function POST(request: Request): Promise<Response> {
  const denied = checkCronAuth(request);
  if (denied) return denied;
  try {
    const result = await dispatchDueNotifications();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[dispatch]", error);
    return Response.json({ error: "dispatch failed" }, { status: 500 });
  }
}
