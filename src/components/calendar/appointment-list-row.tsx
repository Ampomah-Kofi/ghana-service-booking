import Link from "next/link";
import { SourceBadge, STATUS, StatusBadge } from "@/components/bookings/status-badge";
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
}: {
  appointment: AppointmentView;
  href: string;
  timezone: string;
  showStaff: boolean;
  /** Shown above the time in lists that span several days. */
  dateLabel?: string;
}) {
  const cancelled = a.status === "cancelled";
  return (
    <li>
      <Link href={href} className="flex min-h-16 items-stretch gap-3 px-4 py-3 hover:bg-fill active:bg-fill">
        <span className={`w-20 shrink-0 text-small tabular-nums ${cancelled ? "text-ink-muted line-through" : ""}`}>
          {dateLabel ? <span className="block text-caption text-ink-muted">{dateLabel}</span> : null}
          <span className="block font-semibold">{formatTime(a.startsAt, timezone)}</span>
          <span className="block text-ink-muted">{formatTime(a.endsAt, timezone)}</span>
        </span>
        <span aria-hidden="true" className={`w-1 shrink-0 rounded-full ${STATUS[a.status].bar}`} />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-body font-medium ${cancelled ? "text-ink-muted" : ""}`}>
            {a.customerName}
          </span>
          <span className="block truncate text-small text-ink-muted">
            {a.serviceName}
            {showStaff && a.staffName ? ` · ${a.staffName}` : ""}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <StatusBadge status={a.status} />
            <SourceBadge source={a.source} />
          </span>
        </span>
        <ChevronRightIcon className="shrink-0 self-center text-ink-muted" />
      </Link>
    </li>
  );
}
