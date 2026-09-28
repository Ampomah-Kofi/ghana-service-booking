import Link from "next/link";
import { BellIcon } from "./icons";

/** Bell with an unread count (Phase 8). A round control, like the account circle beside it. */
export function NotificationBell({ unread, className = "bg-fill text-ink" }: { unread: number; className?: string }) {
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className={`pressable relative flex size-10 shrink-0 items-center justify-center rounded-full ${className}`}
    >
      <BellIcon className="size-5" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="pop absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-caption leading-5 font-bold text-white ring-2 ring-surface"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
