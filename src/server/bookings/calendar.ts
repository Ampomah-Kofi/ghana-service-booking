import "server-only";
import type { MemberBusiness } from "@/server/businesses/access";
import { getBusinessHours, listBlockedTimesBetween, type BlockedTimeView } from "@/server/businesses/schedule";
import { listStaff, type StaffView } from "@/server/businesses/team";
import { addDays, intersectRanges, isoWeekday, localToInstant } from "@/lib/availability";
import { minutesOf, type HoursRange } from "@/lib/hours";
import { listBusinessAppointments, type AppointmentView } from "./appointments";

export type CalendarStaff = Pick<StaffView, "id" | "displayName" | "roleTitle" | "isActive">;

export type CalendarRange = {
  dates: string[];
  timezone: string;
  /** Columns: managers see the whole active team (or one person when filtered); staff see themselves. */
  staff: CalendarStaff[];
  /** Everyone the viewer could filter by (before the staff filter). */
  team: CalendarStaff[];
  /** Working minutes per staff per date: `${staffId}|${date}` → ranges. */
  working: Map<string, { from: number; to: number }[]>;
  appointments: AppointmentView[];
  blocks: BlockedTimeView[];
};

function rangesFor(hours: HoursRange[], weekday: number) {
  return hours
    .filter((h) => h.weekday === weekday)
    .map((h) => ({ from: minutesOf(h.opens), to: minutesOf(h.closes) }))
    .sort((a, b) => a.from - b.from);
}

/**
 * Everything the calendar draws for consecutive local dates: team columns, working hours,
 * appointments (not cancelled) and time off. RLS limits staff to their own appointments.
 */
export async function getCalendarRange(
  member: MemberBusiness,
  { from, days, staffId = null }: { from: string; days: number; staffId?: string | null },
): Promise<CalendarRange> {
  const { db, business } = member;
  const tz = business.timezone;
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const start = localToInstant(from, 0, tz);
  const end = localToInstant(dates[dates.length - 1], 1440, tz);

  const [team, hours, appointments, blocks] = await Promise.all([
    listStaff(db, business.id, { withInvites: false }),
    getBusinessHours(db, business.id),
    listBusinessAppointments(db, business.id, { from: start, to: end }),
    listBlockedTimesBetween(db, business.id, start, end),
  ]);

  const allowed = team.filter((s) =>
    member.canManage ? s.isActive || appointments.some((a) => a.staffId === s.id) : s.id === member.ownStaffId,
  );
  const visible = allowed.filter((s) => staffId === null || s.id === staffId);
  const toView = (s: StaffView): CalendarStaff => ({
    id: s.id,
    displayName: s.displayName,
    roleTitle: s.roleTitle,
    isActive: s.isActive,
  });
  const visibleIds = new Set(visible.map((s) => s.id));

  const working = new Map<string, { from: number; to: number }[]>();
  for (const s of visible) {
    for (const date of dates) {
      const weekday = isoWeekday(date);
      const business = rangesFor(hours, weekday);
      working.set(
        `${s.id}|${date}`,
        s.usesBusinessHours ? business : intersectRanges(business, rangesFor(s.hours, weekday)),
      );
    }
  }

  return {
    dates,
    timezone: tz,
    staff: visible.map(toView),
    team: allowed.map(toView),
    working,
    appointments: appointments.filter((a) => visibleIds.has(a.staffId)),
    blocks: blocks.filter((b) => b.staffId === null || visibleIds.has(b.staffId)),
  };
}
