import "server-only";
import type { z } from "zod";
import { nullableArg, type Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import type { bookingRulesSchema, blockedTimeSchema } from "@/schemas/catalog";
import type { HoursRange } from "@/lib/hours";
import { AppError } from "@/lib/errors";
import { toAppError } from "./errors";
import { toHours } from "./team";

export async function getBusinessHours(db: Db, businessId: string): Promise<HoursRange[]> {
  const { data, error } = await db.from("business_hours").select("weekday, during").eq("business_id", businessId);
  if (error) throw toAppError(error);
  return toHours(data);
}

export async function setBusinessHours(db: Db, businessId: string, hours: HoursRange[]): Promise<void> {
  const { error } = await db.rpc("set_business_hours", { p_business_id: businessId, p_hours: hours });
  if (error) throw toAppError(error);
}

export type BlockedTimeView = {
  id: string;
  staffId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

/** "[\"2026-10-01 09:00:00+00\",\"2026-10-01 12:00:00+00\")" → ISO instants. */
function parseTstzRange(value: string): { start: string; end: string } | null {
  const match = /^[[(]"?([^",]+)"?,"?([^")\]]+)"?[)\]]$/.exec(value);
  if (!match) return null;
  const start = new Date(match[1].replace(" ", "T").replace(/\+00$/, "Z"));
  const end = new Date(match[2].replace(" ", "T").replace(/\+00$/, "Z"));
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? null
    : { start: start.toISOString(), end: end.toISOString() };
}

export async function listUpcomingBlockedTimes(db: Db, businessId: string): Promise<BlockedTimeView[]> {
  const { data, error } = await db
    .from("blocked_times")
    .select("id, staff_id, during, reason")
    .eq("business_id", businessId);
  if (error) throw toAppError(error);
  const now = Date.now();
  return data
    .flatMap((row) => {
      const range = typeof row.during === "string" ? parseTstzRange(row.during) : null;
      return range
        ? [{ id: row.id, staffId: row.staff_id, startsAt: range.start, endsAt: range.end, reason: row.reason }]
        : [];
    })
    .filter((b) => new Date(b.endsAt).getTime() > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function createBlockedTime(
  db: Db,
  businessId: string,
  input: z.infer<typeof blockedTimeSchema>,
): Promise<void> {
  const { error } = await db.rpc("create_blocked_time", {
    p_business_id: businessId,
    p_staff_id: nullableArg(input.staffId),
    p_starts_local: input.startsLocal,
    p_ends_local: input.endsLocal,
    p_reason: input.reason ?? "",
  });
  if (error) throw toAppError(error);
}

export async function deleteBlockedTime(db: Db, businessId: string, blockId: string): Promise<void> {
  const { data, error } = await db
    .from("blocked_times")
    .delete()
    .eq("business_id", businessId)
    .eq("id", blockId)
    .select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That time off no longer exists.");
}

type BookingRulesRow = Database["public"]["Tables"]["booking_rules"]["Row"];

export async function getBookingRules(db: Db, businessId: string): Promise<BookingRulesRow> {
  const { data, error } = await db.from("booking_rules").select("*").eq("business_id", businessId).single();
  if (error) throw toAppError(error);
  return data;
}

export async function saveBookingRules(
  db: Db,
  businessId: string,
  input: z.infer<typeof bookingRulesSchema>,
): Promise<void> {
  const { data, error } = await db
    .from("booking_rules")
    .update({
      slot_interval_minutes: input.slotIntervalMinutes,
      min_notice_minutes: input.minNoticeMinutes,
      max_advance_days: input.maxAdvanceDays,
      buffer_before_minutes: input.bufferBeforeMinutes,
      buffer_after_minutes: input.bufferAfterMinutes,
      cancellation_window_hours: input.cancellationWindowHours,
      reschedule_window_hours: input.cancellationWindowHours,
      auto_confirm: input.autoConfirm,
    })
    .eq("business_id", businessId)
    .select("business_id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");
}
