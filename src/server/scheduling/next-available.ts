import "server-only";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";
import { toHours } from "@/server/businesses/team";
import { availableSlots, localDateOf, type BusyInterval } from "@/lib/availability";
import { formatTime } from "@/lib/datetime";

export type NextAvailable = { at: Date; label: string };

/**
 * The earliest bookable start *today* (each business's own local day) for many businesses,
 * with a fixed number of queries whatever the count: the same engine as the booking page,
 * fed in bulk. Businesses with nothing left today are simply absent from the map.
 */
export async function nextAvailableToday(
  db: Db,
  businessIds: string[],
  now = new Date(),
): Promise<Map<string, NextAvailable>> {
  const ids = [...new Set(businessIds)].slice(0, 60);
  const result = new Map<string, NextAvailable>();
  if (ids.length === 0) return result;

  const [businesses, rules, hours, services, staff, busy] = await Promise.all([
    db.from("businesses").select("id, timezone").in("id", ids),
    db.from("booking_rules").select("*").in("business_id", ids),
    db.from("business_hours").select("business_id, weekday, during").in("business_id", ids),
    db
      .from("services")
      .select("id, business_id, duration_minutes, staff_services ( staff_id )")
      .in("business_id", ids)
      .eq("is_active", true)
      .is("deleted_at", null),
    db
      .from("staff")
      .select("id, business_id, uses_business_hours, staff_working_hours ( weekday, during )")
      .in("business_id", ids)
      .eq("is_active", true)
      .eq("accepts_online_bookings", true)
      .is("deleted_at", null),
    // Today in any timezone lies within [now − 4h (buffers), now + 30h).
    db.rpc("get_busy_intervals_many", {
      p_business_ids: ids,
      p_from: new Date(now.getTime() - 4 * 3_600_000).toISOString(),
      p_to: new Date(now.getTime() + 30 * 3_600_000).toISOString(),
    }),
  ]);
  for (const r of [businesses, rules, hours, services, staff, busy]) if (r.error) throw toAppError(r.error);

  const busyBy = new Map<string, BusyInterval[]>();
  for (const b of busy.data ?? []) {
    const list = busyBy.get(b.business_id) ?? [];
    list.push({
      staffId: b.staff_id,
      start: new Date(b.starts_at),
      end: new Date(b.ends_at),
      kind: b.kind === "block" ? "block" : "appointment",
    });
    busyBy.set(b.business_id, list);
  }

  for (const business of businesses.data ?? []) {
    const r = rules.data?.find((x) => x.business_id === business.id);
    if (!r) continue;
    const date = localDateOf(now, business.timezone);
    const businessHours = toHours((hours.data ?? []).filter((h) => h.business_id === business.id));
    const team = (staff.data ?? []).filter((s) => s.business_id === business.id);
    let best: Date | null = null;
    for (const service of (services.data ?? []).filter((s) => s.business_id === business.id)) {
      const eligible = team.filter((s) => service.staff_services.some((x) => x.staff_id === s.id));
      if (eligible.length === 0) continue;
      const [first] = availableSlots({
        timezone: business.timezone,
        date,
        now,
        rules: {
          slotIntervalMinutes: r.slot_interval_minutes,
          minNoticeMinutes: r.min_notice_minutes,
          maxAdvanceDays: r.max_advance_days,
          bufferBeforeMinutes: r.buffer_before_minutes,
          bufferAfterMinutes: r.buffer_after_minutes,
        },
        durationMinutes: service.duration_minutes,
        businessHours,
        staff: eligible.map((s) => ({
          id: s.id,
          usesBusinessHours: s.uses_business_hours,
          hours: toHours(s.staff_working_hours),
        })),
        busy: busyBy.get(business.id) ?? [],
      });
      if (first && (!best || first.start < best)) best = first.start;
    }
    if (best) result.set(business.id, { at: best, label: `Today ${formatTime(best, business.timezone)}` });
  }
  return result;
}
