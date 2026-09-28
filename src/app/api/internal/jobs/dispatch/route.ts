import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/server/env";
import { dispatchDueNotifications } from "@/server/jobs/dispatch";

/**
 * POST /api/internal/jobs/dispatch: sends due notifications. Called every minute by pg_cron + pg_net
 * (hosted) or scripts/dev/dispatch-loop.mjs (local) with `Authorization: Bearer <CRON_SECRET>`.
 * Not part of the public API.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "dispatcher not configured" }, { status: 503 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await dispatchDueNotifications();
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[dispatch]", error);
    return Response.json({ error: "dispatch failed" }, { status: 500 });
  }
}
