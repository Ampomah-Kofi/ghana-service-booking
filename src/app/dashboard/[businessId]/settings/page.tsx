import type { Metadata } from "next";
import { saveBusinessAlertsAction } from "@/app/notifications/actions";
import { formatPhoneInternational } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import Link from "next/link";
import { BookingRulesForm } from "@/components/business/booking-rules-form";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getBookingRules } from "@/server/businesses/schedule";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/dashboard/[businessId]/settings">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const { db, business } = await managedBusinessOr404(businessId);
  const rules = await getBookingRules(db, business.id);
  const setup = (step: string) => `/dashboard/${business.id}/setup/${step}`;

  return (
    <>
      <h1 className="mb-5 text-display font-bold">Settings</h1>
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
      <h2 className="mt-8 mb-2 px-4 text-heading font-semibold text-ink">Alerts</h2>
      {sp.saved === "alerts" ? <Toast message="Alerts saved" param="saved" /> : null}
      <form action={saveBusinessAlertsAction} className="rounded-card bg-card lift">
        <input type="hidden" name="businessId" value={business.id} />
        <label className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
          <span className="min-w-0">
            <span className="block text-body">Text me about new bookings</span>
            <span className="block text-small text-ink-muted">
              {business.phone ? `To ${formatPhoneInternational(business.phone)}. ` : "Add a business phone first. "}
              You always get them in the app.
            </span>
          </span>
          <input type="checkbox" role="switch" name="sms" defaultChecked={business.notifyNewBookingSms} />
        </label>
        <div className="border-t border-border px-4 py-3">
          <Button type="submit" variant="secondary">
            Save alerts
          </Button>
        </div>
      </form>
      <h2 className="mb-2 mt-8 px-4 text-heading font-semibold text-ink">Business profile</h2>
      <ul className="ios-list overflow-hidden rounded-card bg-card lift">
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
