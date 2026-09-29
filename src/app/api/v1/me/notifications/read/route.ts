import { markReadBody } from "@/schemas/api-v1";
import { apiError, apiUser, json, validationError } from "@/server/api/http";
import { markRead } from "@/server/notifications/inbox";

/** POST /api/v1/me/notifications/read (Bearer): mark the given messages (or all) read. */
export async function POST(request: Request) {
  try {
    const { db } = await apiUser(request);
    const parsed = markReadBody.safeParse((await request.json().catch(() => ({}))) ?? {});
    if (!parsed.success) return validationError(parsed.error);
    await markRead(db, parsed.data.ids);
    return json({ data: { ok: true } }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
