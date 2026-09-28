import type { AppointmentStatus } from "@/server/bookings/appointments";

/** Status tones and labels (docs/design.md §3a). Colour is never the only signal. */
export const STATUS: Record<AppointmentStatus, { label: string; bar: string; badge: string; soft: string }> = {
  pending: { label: "Pending", bar: "bg-warning", badge: "bg-warning/12 text-warning", soft: "bg-warning/8" },
  confirmed: { label: "Confirmed", bar: "bg-primary", badge: "bg-primary-soft text-primary", soft: "bg-primary-soft" },
  arrived: { label: "Arrived", bar: "bg-info", badge: "bg-info/12 text-info", soft: "bg-info/8" },
  completed: { label: "Completed", bar: "bg-ink-muted", badge: "bg-fill text-ink-muted", soft: "bg-fill" },
  cancelled: { label: "Cancelled", bar: "bg-ink-muted", badge: "bg-fill text-ink-muted", soft: "bg-fill" },
  no_show: { label: "No-show", bar: "bg-danger", badge: "bg-danger/10 text-danger", soft: "bg-danger/8" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex max-w-full shrink-0 items-center rounded-chip px-2 py-0.5 text-caption ${s.badge}`}>
      {s.label}
    </span>
  );
}

export function SourceBadge({ source }: { source: "online" | "manual" | "walk_in" }) {
  if (source === "online") return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-chip border border-border px-2 py-0.5 text-caption text-ink-muted">
      {source === "walk_in" ? "Walk-in" : "Phone"}
    </span>
  );
}
