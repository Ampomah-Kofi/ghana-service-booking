import type { Metadata } from "next";
import Link from "next/link";
import { BookingRulesForm } from "@/components/business/booking-rules-form";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getBookingRules } from "@/server/businesses/schedule";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: PageProps<"/dashboard/[businessId]/settings">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const rules = await getBookingRules(db, business.id);
  const setup = (step: string) => `/dashboard/${business.id}/setup/${step}`;

  return (
    <>
      <h1 className="mb-5 text-display font-bold tracking-tight">Settings</h1>
      <h2 className="mb-2 px-4 text-heading font-semibold text-ink">Booking rules</h2>
      <BookingRulesForm
        businessId={business.id}
        values={{
          slotIntervalMinutes: rules.slot_interval_minutes,
          minNoticeMinutes: rules.min_notice_minutes,
          maxAdvanceDays: rules.max_advance_days,
          bufferBeforeMinutes: rules.buffer_before_minutes,
          bufferAfterMinutes: rules.buffer_after_minutes,
          cancellationWindowHours: rules.cancellation_window_hours,
          autoConfirm: rules.auto_confirm,
        }}
      />
      <h2 className="mb-2 mt-8 px-4 text-heading font-semibold text-ink">Business profile</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-card bg-card border border-border">
        {[
          ["about", "Name, category and description"],
          ["location", "Location"],
          ["contact", "Contact details"],
          ["photos", "Logo and photos"],
        ].map(([step, label]) => (
          <li key={step}>
            <Link
              href={setup(step)}
              className="flex min-h-11 items-center justify-between px-4 py-3 text-body hover:bg-fill"
            >
              {label}
              <span aria-hidden="true" className="text-ink-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
