import "server-only";
import { renderNotification, type NotificationPayload, type Rendered } from "@/lib/notification-templates";
import { publicEnv } from "@/lib/public-env";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export type InboxItem = Pick<Rendered, "title" | "body" | "href" | "audience"> & {
  id: string;
  template: string;
  at: string;
  read: boolean;
};

/** The caller's in-app messages that are due, newest first (RLS: own, due, not withdrawn). */
export async function listMyNotifications(db: Db, { limit = 50 } = {}): Promise<InboxItem[]> {
  const { data, error } = await db
    .from("notifications")
    .select("id, template_key, payload, scheduled_for, read_at")
    .eq("channel", "in_app")
    .order("scheduled_for", { ascending: false })
    .limit(Math.min(limit, 100));
  if (error) throw toAppError(error);
  const site = publicEnv().NEXT_PUBLIC_SITE_URL;
  return data.map((n) => {
    const r = renderNotification(n.template_key, (n.payload ?? {}) as NotificationPayload, site);
    return {
      id: n.id,
      template: n.template_key,
      title: r.title,
      body: r.body,
      href: r.href,
      audience: r.audience,
      at: n.scheduled_for,
      read: n.read_at !== null,
    };
  });
}

export async function unreadCount(db: Db): Promise<number> {
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("channel", "in_app")
    .is("read_at", null);
  if (error) throw toAppError(error);
  return count ?? 0;
}

/** Marks the given messages (or all of them) read. RLS limits it to the caller's own, due messages. */
export async function markRead(db: Db, ids?: string[]): Promise<void> {
  let q = db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("channel", "in_app")
    .is("read_at", null);
  if (ids) q = q.in("id", ids.slice(0, 200));
  const { error } = await q;
  if (error) throw toAppError(error);
}

export type TextChannel = "sms" | "whatsapp" | "none";
export type MessagePreferences = { text: TextChannel; email: boolean };

/** One text channel per message (ADR-0013): SMS unless the person chose WhatsApp, or none. */
export async function getMessagePreferences(db: Db, userId: string): Promise<MessagePreferences> {
  const { data, error } = await db
    .from("profiles")
    .select("notify_sms, notify_whatsapp, notify_email")
    .eq("id", userId)
    .single();
  if (error) throw toAppError(error);
  return {
    text: data.notify_sms ? "sms" : data.notify_whatsapp ? "whatsapp" : "none",
    email: data.notify_email,
  };
}

export async function setMessagePreferences(db: Db, userId: string, prefs: MessagePreferences): Promise<void> {
  const { error } = await db
    .from("profiles")
    .update({
      notify_sms: prefs.text === "sms",
      notify_whatsapp: prefs.text === "whatsapp",
      notify_email: prefs.email,
    })
    .eq("id", userId);
  if (error) throw toAppError(error);
}

export async function setBusinessBookingSms(db: Db, businessId: string, on: boolean): Promise<void> {
  const { error } = await db.from("businesses").update({ notify_new_booking_sms: on }).eq("id", businessId);
  if (error) throw toAppError(error);
}
