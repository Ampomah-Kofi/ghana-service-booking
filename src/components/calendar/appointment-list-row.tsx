import Link from "next/link";
import { PaymentBadge, STATUS, StatusBadge } from "@/components/bookings/status-badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatTime } from "@/lib/datetime";
import type { AppointmentView } from "@/server/bookings/appointments";

/** A booking in a day list: time, a status bar, who and what. The whole row opens it. */
export function AppointmentListRow({
  appointment: a,
  href,
  timezone,
  showStaff,
  dateLabel,
  hideCustomer = false,
}: {
  appointment: AppointmentView;
  href: string;
  timezone: string;
  showStaff: boolean;
  /** Shown above the time in lists that span several days. */
  dateLabel?: string;
  /** On a client's own page: lead with the service instead of repeating their name. */
  hideCustomer?: boolean;
}) {
  const cancelled = a.status === "cancelled";
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-stretch gap-3 px-4 py-3 hover:bg-fill active:bg-fill">
        <span
          className={`w-[4.75rem] shrink-0 whitespace-nowrap text-small tabular-nums ${cancelled ? "text-ink-muted line-through" : ""}`}
        >
          {dateLabel ? <span className="block text-caption text-ink-muted">{dateLabel}</span> : null}
          <span className="block font-semibold">{formatTime(a.startsAt, timezone)}</span>
          <span className="block text-ink-muted">{formatTime(a.endsAt, timezone)}</span>
        </span>
        <span aria-hidden="true" className={`w-1 shrink-0 rounded-full ${STATUS[a.status].bar}`} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-body font-medium ${cancelled ? "text-ink-muted" : ""}`}>
            {hideCustomer ? a.serviceName : a.customerName}
          </span>
          <span className="block truncate text-small text-ink-muted">
            {[
              hideCustomer ? null : a.serviceName,
              showStaff && a.staffName ? (hideCustomer ? `with ${a.staffName}` : a.staffName) : null,
              a.source === "walk_in" ? "Walk-in" : a.source === "manual" ? "By phone" : hideCustomer ? "Online" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            <StatusBadge status={a.status} />
            <PaymentBadge status={a.paymentStatus} paying={a.holdExpiresAt !== null} />
          </span>
        </span>
        <ChevronRightIcon className="shrink-0 self-center text-ink-muted" />
      </Link>
    </li>
  );
}
