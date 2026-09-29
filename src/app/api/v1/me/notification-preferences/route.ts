import { notificationPreferences } from "@/schemas/api-v1";
import { apiError, apiUser, json, validationError } from "@/server/api/http";
import { getMessagePreferences, setMessagePreferences } from "@/server/notifications/inbox";

/** GET /api/v1/me/notification-preferences (Bearer). */
export async function GET(request: Request) {
  try {
    const { db, userId } = await apiUser(request);
    return json({ data: await getMessagePreferences(db, userId) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}

/** PUT /api/v1/me/notification-preferences (Bearer): { text: sms | whatsapp | none, email }. */
export async function PUT(request: Request) {
  try {
    const { db, userId } = await apiUser(request);
    const parsed = notificationPreferences.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return validationError(parsed.error);
    await setMessagePreferences(db, userId, parsed.data);
    return json({ data: await getMessagePreferences(db, userId) }, { personalised: true });
  } catch (error) {
    return apiError(error);
  }
}
