import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/server/env";

/** Internal job routes: `Authorization: Bearer <CRON_SECRET>`, compared in constant time. */
export function checkCronAuth(request: Request): Response | null {
  const secret = serverEnv().CRON_SECRET;
  if (!secret) return Response.json({ error: "jobs not configured" }, { status: 503 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
