import "server-only";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { Db } from "@/server/db/client";
import { listServices, type ServiceView } from "@/server/businesses/catalog";
import { getBookingRules, getBusinessHours } from "@/server/businesses/schedule";
import { listStaff, type StaffView } from "@/server/businesses/team";
import { toAppError } from "@/server/businesses/errors";
import { AppError } from "@/lib/errors";
import type { HoursRange } from "@/lib/hours";
import {
  addDays,
  availableSlots,
  localDateOf,
  localToInstant,
  orderForAnyAvailable,
  type BookingRules,
  type BusyInterval,
  type Slot,
} from "@/lib/availability";

/** Buffers are capped at 240 minutes (DB check), so ±4h around a day covers every neighbour. */
const BUFFER_MARGIN_MS = 4 * 60 * 60_000;
/** The day strip in the booking flow. */
export const DAYS_PER_PAGE = 14;

export type BookingSetup = {
  businessId: string;
  timezone: string;
  rules: BookingRules & {
    cancellationWindowHours: number;
    autoConfirm: boolean;
    /** How customers can pay the business directly (ADR-0017). */
    acceptedPaymentMethods: PaymentMethod[];
  };
  hours: HoursRange[];
  /** Active services with at least one person who takes online bookings for them. */
  services: ServiceView[];
  /** People who take online bookings, in display order. */
  staff: StaffView[];
};

/**
 * Everything the availability calculator needs about a business, read as the
 * caller (RLS: the public sees published businesses' active services/staff).
 */
export async function getBookingSetup(db: Db, business: { id: string; timezone: string }): Promise<BookingSetup> {
  const [rules, hours, services, staff] = await Promise.all([
    getBookingRules(db, business.id),
    getBusinessHours(db, business.id),
    listServices(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
  ]);
  const bookableStaff = staff.filter((s) => s.isActive && s.acceptsOnlineBookings);
  const bookableIds = new Set(bookableStaff.map((s) => s.id));
  return {
    businessId: business.id,
    timezone: business.timezone,
    rules: {
      slotIntervalMinutes: rules.slot_interval_minutes,
      minNoticeMinutes: rules.min_notice_minutes,
      maxAdvanceDays: rules.max_advance_days,
      bufferBeforeMinutes: rules.buffer_before_minutes,
      bufferAfterMinutes: rules.buffer_after_minutes,
      cancellationWindowHours: rules.cancellation_window_hours,
      autoConfirm: rules.auto_confirm,
      acceptedPaymentMethods: rules.accepted_payment_methods,
    },
    hours,
    services: services.filter((s) => s.isActive && s.staffIds.some((id) => bookableIds.has(id))),
    staff: bookableStaff,
  };
}

/** Who can be booked for a service, optionally narrowed to one chosen person. */
export function staffForService(setup: BookingSetup, serviceId: string, staffId: string | null = null): StaffView[] {
  const service = setup.services.find((s) => s.id === serviceId);
  if (!service) return [];
  return setup.staff.filter((s) => service.staffIds.includes(s.id) && (staffId === null || s.id === staffId));
}

async function getBusyIntervals(db: Db, businessId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const { data, error } = await db.rpc("get_busy_intervals", {
    p_business_id: businessId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw toAppError(error);
  return data.map((row) => ({
    staffId: row.staff_id,
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    kind: row.kind === "block" ? "block" : "appointment",
  }));
}

export type DayAvailability = { date: string; slots: Slot[] };

/**
 * Open start times for `days` consecutive local dates from `fromDate`, with one
 * database round trip. For "any available", each slot's staffIds come fairest-first.
 */
export async function getAvailability(
  db: Db,
  setup: BookingSetup,
  params: { serviceId: string; staffId: string | null; fromDate: string; days: number; now?: Date },
): Promise<DayAvailability[]> {
  const service = setup.services.find((s) => s.id === params.serviceId);
  if (!service) throw new AppError("NOT_FOUND", "That service can't be booked online.");
  const staff = staffForService(setup, service.id, params.staffId);
  if (params.staffId !== null && staff.length === 0) {
    throw new AppError("NOT_FOUND", "That person doesn't offer this service online.");
  }
  if (params.days < 1 || params.days > 31) throw new AppError("VALIDATION", "Ask for 1-31 days at a time.");

  const now = params.now ?? new Date();
  const lastDate = addDays(params.fromDate, params.days - 1);
  const from = new Date(localToInstant(params.fromDate, 0, setup.timezone).getTime() - BUFFER_MARGIN_MS);
  const to = new Date(localToInstant(lastDate, 1440, setup.timezone).getTime() + BUFFER_MARGIN_MS);
  const busy = staff.length > 0 ? await getBusyIntervals(db, setup.businessId, from, to) : [];
  const displayOrder = setup.staff.map((s) => s.id);

  const result: DayAvailability[] = [];
  for (let i = 0; i < params.days; i++) {
    const date = addDays(params.fromDate, i);
    const dayStart = localToInstant(date, 0, setup.timezone).getTime();
    const dayEnd = localToInstant(date, 1440, setup.timezone).getTime();
    const dayBusy = busy.filter((b) => b.end.getTime() > dayStart && b.start.getTime() < dayEnd);
    const slots = availableSlots({
      timezone: setup.timezone,
      date,
      now,
      rules: setup.rules,
      durationMinutes: service.durationMinutes,
      businessHours: setup.hours,
      staff: staff.map((s) => ({ id: s.id, usesBusinessHours: s.usesBusinessHours, hours: s.hours })),
      busy,
    }).map((slot) => ({ ...slot, staffIds: orderForAnyAvailable(slot.staffIds, dayBusy, displayOrder) }));
    result.push({ date, slots });
  }
  return result;
}

/**
 * The people to try, in order, for a booking at `startsAt`. Empty when the time
 * isn't open any more. The database re-checks everything (book_appointment).
 */
export async function candidatesFor(
  db: Db,
  setup: BookingSetup,
  params: { serviceId: string; staffId: string | null; startsAt: Date; now?: Date },
): Promise<string[]> {
  const date = localDateOf(params.startsAt, setup.timezone);
  const [day] = await getAvailability(db, setup, { ...params, fromDate: date, days: 1 });
  return day.slots.find((s) => s.start.getTime() === params.startsAt.getTime())?.staffIds ?? [];
}

/** Today's date in the business's timezone. */
export function todayIn(timezone: string, now = new Date()): string {
  return localDateOf(now, timezone);
}

/** Last date a customer may book, from the business's max-advance rule. */
export function lastBookableDate(setup: BookingSetup, now = new Date()): string {
  return localDateOf(new Date(now.getTime() + setup.rules.maxAdvanceDays * 86_400_000), setup.timezone);
}
