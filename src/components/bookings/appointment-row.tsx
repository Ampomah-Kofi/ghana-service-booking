import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import type { AppointmentView } from "@/server/bookings/appointments";
import { StatusBadge } from "./status-badge";

/** One booking in a list. `who` is the other party: the business for customers, the customer for providers. */
export function AppointmentRow({
  appointment,
  href,
  who,
  detail,
  action,
}: {
  appointment: AppointmentView;
  href?: string;
  who: string;
  detail?: string;
  /** A secondary action under the row, e.g. "Book again". */
  action?: { href: string; label: string };
}) {
  const tz = appointment.business.timezone ?? "UTC";
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">{who}</span>
        <span className="block truncate text-small text-ink-muted">
          {appointment.serviceName}
          {appointment.staffName ? ` · ${appointment.staffName}` : ""}
        </span>
        <span className="block text-small tabular-nums text-ink-muted">
          {formatDateTime(appointment.startsAt, tz)}
          {detail ? ` · ${detail}` : ""}
        </span>
      </span>
      <StatusBadge status={appointment.status} />
      {href ? (
        <span aria-hidden="true" className="text-ink-muted">
          ›
        </span>
      ) : null}
    </>
  );
  const className = "flex min-h-11 items-center gap-3 px-4 py-3";
  return (
    <li>
      {href ? (
        <Link href={href} className={`${className} hover:bg-fill`}>
          {body}
        </Link>
      ) : (
        <div className={className}>{body}</div>
      )}
      {action ? (
        <div className="px-4 pb-3">
          <Link
            href={action.href}
            className="pressable inline-flex min-h-10 items-center rounded-full bg-primary-soft px-4 text-small font-semibold text-primary"
          >
            {action.label}
          </Link>
        </div>
      ) : null}
    </li>
  );
}
