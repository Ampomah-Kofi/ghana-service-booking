import "server-only";
import { nullableArg, type Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";
import type { AppointmentStatus } from "./appointments";

/**
 * Provider actions (SPEC §8). Thin wrappers: the SQL functions decide who may act
 * (managers: everyone; staff: their own column) and which changes are allowed.
 */
export type ManualAppointmentInput = {
  serviceId: string;
  staffId: string;
  startsAt: Date;
  client: { id: string } | { name: string; phone: string | null };
  note: string | null;
  walkIn: boolean;
  allowOutsideHours: boolean;
};

export async function addManualAppointment(db: Db, businessId: string, input: ManualAppointmentInput): Promise<string> {
  const existing = "id" in input.client ? input.client.id : null;
  const { data, error } = await db.rpc("create_manual_appointment", {
    p_business_id: businessId,
    p_service_id: input.serviceId,
    p_staff_id: input.staffId,
    p_starts_at: input.startsAt.toISOString(),
    p_client_id: nullableArg(existing),
    p_client_name: nullableArg("name" in input.client ? input.client.name : null),
    p_client_phone: nullableArg("phone" in input.client ? input.client.phone : null),
    p_note: nullableArg(input.note),
    p_walk_in: input.walkIn,
    p_allow_outside_hours: input.allowOutsideHours,
  });
  if (error) throw toAppError(error);
  return data;
}

export async function setAppointmentStatus(
  db: Db,
  appointmentId: string,
  status: AppointmentStatus,
  { reason = null, finalPriceMinor = null }: { reason?: string | null; finalPriceMinor?: number | null } = {},
): Promise<void> {
  const { error } = await db.rpc("set_appointment_status", {
    p_appointment_id: appointmentId,
    p_status: status,
    p_reason: nullableArg(reason),
    p_final_price_minor: nullableArg(finalPriceMinor),
  });
  if (error) throw toAppError(error);
}

export async function moveAppointment(
  db: Db,
  appointmentId: string,
  { staffId, startsAt, allowOutsideHours = false }: { staffId: string; startsAt: Date; allowOutsideHours?: boolean },
): Promise<void> {
  const { error } = await db.rpc("move_appointment", {
    p_appointment_id: appointmentId,
    p_staff_id: staffId,
    p_starts_at: startsAt.toISOString(),
    p_allow_outside_hours: allowOutsideHours,
  });
  if (error) throw toAppError(error);
}

/** The actions the appointment sheet offers for a status (mirrors set_appointment_status). */
export function nextStatuses(status: AppointmentStatus, startsAt: Date, now = new Date()): AppointmentStatus[] {
  const started = startsAt.getTime() <= now.getTime();
  const arrivable = startsAt.getTime() - now.getTime() <= 60 * 60_000;
  switch (status) {
    case "pending":
      return [
        "confirmed",
        ...(arrivable ? (["arrived"] as const) : []),
        ...(started ? (["no_show"] as const) : []),
        "cancelled",
      ];
    case "confirmed":
      return [
        ...(arrivable ? (["arrived"] as const) : []),
        ...(started ? (["completed", "no_show"] as const) : []),
        "cancelled",
      ];
    case "arrived":
      return started ? ["completed", "cancelled"] : ["confirmed", "cancelled"];
    default:
      return [];
  }
}

/** Undo for a recent mistake (completed → arrived, no-show → confirmed) within 7 days. */
export function undoStatus(status: AppointmentStatus, endsAt: Date, now = new Date()): AppointmentStatus | null {
  if (now.getTime() - endsAt.getTime() > 7 * 86_400_000) return null;
  return status === "completed" ? "arrived" : status === "no_show" ? "confirmed" : null;
}
