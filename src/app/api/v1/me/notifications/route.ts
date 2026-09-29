import { apiError, apiUser, json } from "@/server/api/http";
import { listMyNotifications } from "@/server/notifications/inbox";

/** GET /api/v1/me/notifications (Bearer): your in-app messages that are due, newest first, with the unread count. */
export async function GET(request: Request) {
  try {
    const { db } = await apiUser(request);
    const items = await listMyNotifications(db);
    return json({ data: items, meta: { unread: items.filter((i) => !i.read).length } }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
