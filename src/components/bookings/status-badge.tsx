import type { AppointmentStatus } from "@/server/bookings/appointments";

const labels: Record<AppointmentStatus, { text: string; className: string }> = {
  pending: { text: "Awaiting confirmation", className: "bg-warning/15 text-warning" },
  confirmed: { text: "Confirmed", className: "bg-success/15 text-success" },
  arrived: { text: "Arrived", className: "bg-success/15 text-success" },
  completed: { text: "Completed", className: "bg-fill text-text-secondary" },
  cancelled: { text: "Cancelled", className: "bg-danger/10 text-danger" },
  no_show: { text: "Missed", className: "bg-danger/10 text-danger" },
};

/** Status as text plus colour (colour is never the only signal). */
export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const label = labels[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-footnote font-medium ${label.className}`}>
      {label.text}
    </span>
  );
}
