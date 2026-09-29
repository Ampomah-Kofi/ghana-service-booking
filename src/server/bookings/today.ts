import "server-only";
import type { MemberBusiness } from "@/server/businesses/access";
import { listClients, type ClientSummary } from "@/server/clients/clients";
import { localDateOf, localToInstant } from "@/lib/availability";
import { listBusinessAppointments, type AppointmentView } from "./appointments";

export type TodaySummary = {
  date: string;
  appointments: AppointmentView[];
  /** The appointment happening now, or the next one today. */
  next: AppointmentView | null;
  counts: { booked: number; completed: number; cancelled: number; noShows: number; walkIns: number; toCome: number };
  /** Price of everything not cancelled or missed (final price where recorded), in minor units. */
  expectedRevenueMinor: number;
  currency: { code: string; symbol: string; minorUnit: number };
  recentClients: ClientSummary[];
};

const LIVE = new Set(["pending", "confirmed", "arrived"]);

/** SPEC §8 dashboard: today's numbers, what's next, and recent customers (managers). */
export async function getTodaySummary(member: MemberBusiness, now = new Date()): Promise<TodaySummary> {
  const { db, business } = member;
  const date = localDateOf(now, business.timezone);
  const [appointments, recentClients] = await Promise.all([
    listBusinessAppointments(db, business.id, {
      from: localToInstant(date, 0, business.timezone),
      to: localToInstant(date, 1440, business.timezone),
      includeCancelled: true,
    }),
    member.canManage ? listClients(db, business.id, { sort: "recent", limit: 5 }) : Promise.resolve([]),
  ]);

  const counted = appointments.filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  const next =
    appointments.find((a) => LIVE.has(a.status) && new Date(a.endsAt) > now && new Date(a.startsAt) <= now) ??
    appointments.find((a) => LIVE.has(a.status) && new Date(a.startsAt) > now) ??
    null;

  return {
    date,
    appointments,
    next,
    counts: {
      booked: counted.length,
      completed: appointments.filter((a) => a.status === "completed").length,
      cancelled: appointments.filter((a) => a.status === "cancelled").length,
      noShows: appointments.filter((a) => a.status === "no_show").length,
      walkIns: appointments.filter((a) => a.source === "walk_in" && a.status !== "cancelled").length,
      toCome: appointments.filter((a) => LIVE.has(a.status) && new Date(a.startsAt) > now).length,
    },
    expectedRevenueMinor: counted.reduce((sum, a) => sum + (a.finalPriceMinor ?? a.price.amountMinor), 0),
    currency: business.currency,
    recentClients,
  };
}
