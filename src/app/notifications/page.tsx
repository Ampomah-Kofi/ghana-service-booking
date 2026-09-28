import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { BellIcon, CalendarIcon, ChevronRightIcon, StarIcon, StoreIcon, XIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import { requireUserOrRedirect } from "@/server/auth/session";
import { createUserClient } from "@/server/db/supabase-server";
import { listMyNotifications, type InboxItem } from "@/server/notifications/inbox";
import { MarkReadOnView } from "./mark-read";

export const metadata: Metadata = { title: "Notifications" };

function iconFor(item: InboxItem) {
  if (item.template.includes("cancelled")) return XIcon;
  if (item.template === "review.request") return StarIcon;
  if (item.audience === "business") return StoreIcon;
  return CalendarIcon;
}

/** "Just now", "25 min ago", "3 hr ago", "Yesterday", "Tue, 14 Oct". */
function ago(at: string, now: Date): string {
  const min = Math.round((now.getTime() - new Date(at).getTime()) / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (min < 24 * 60) return `${Math.round(min / 60)} hr ago`;
  if (min < 48 * 60) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(new Date(at));
}

/** Everything that happened to your bookings (and your business's), newest first. */
export default async function NotificationsPage() {
  await requireUserOrRedirect("/notifications");
  const items = await listMyNotifications(await createUserClient());
  const now = new Date();
  const unread = items.filter((i) => !i.read).length;

  return (
    <>
      <LargeTitle title="Notifications" eyebrow={unread > 0 ? `${unread} new` : undefined} />
      <MarkReadOnView hasUnread={unread > 0} />
      {items.length === 0 ? (
        <EmptyState
          icon={BellIcon}
          title="Nothing yet"
          body="Bookings, reminders and replies will show up here."
          action={{ href: "/", label: "Explore", primary: true }}
        />
      ) : (
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {items.map((item) => {
            const Icon = iconFor(item);
            return (
              <li key={item.id}>
                <Link href={item.href} className="flex items-start gap-3 px-4 py-3.5 hover:bg-fill">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full ${
                      item.template.includes("cancelled")
                        ? "bg-danger/10 text-danger"
                        : item.template === "review.request"
                          ? "bg-star/15 text-star"
                          : "bg-primary-soft text-primary"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className={`truncate text-body ${item.read ? "font-medium" : "font-bold"}`}>
                        {item.title}
                      </span>
                      <span className="shrink-0 text-caption text-ink-muted">{ago(item.at, now)}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-small text-ink-muted">{item.body}</span>
                  </span>
                  {item.read ? (
                    <ChevronRightIcon className="mt-3 shrink-0 text-ink-muted" />
                  ) : (
                    <span className="mt-3.5 size-2.5 shrink-0 rounded-full bg-primary" aria-label="New" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
