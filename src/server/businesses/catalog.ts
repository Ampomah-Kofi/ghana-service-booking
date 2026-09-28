import "server-only";
import type { z } from "zod";
import type { Db } from "@/server/db/client";
import type { Database } from "@/server/db/types";
import type { serviceSchema } from "@/schemas/catalog";
import { AppError } from "@/lib/errors";
import { toAppError } from "./errors";

type PriceType = Database["public"]["Enums"]["price_type"];

export type ServiceView = {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  priceType: PriceType;
  currencyCode: string;
  durationMinutes: number;
  isActive: boolean;
  sortOrder: number;
  staffIds: string[];
};

export type ServiceInput = z.infer<ReturnType<typeof serviceSchema>>;

const serviceSelect =
  "id, name, description, price_minor, price_type, currency_code, duration_minutes, is_active, sort_order, staff_services ( staff_id )";

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price_minor: number;
  price_type: PriceType;
  currency_code: string;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
  staff_services: { staff_id: string }[];
};

function toView(row: ServiceRow): ServiceView {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceMinor: row.price_minor,
    priceType: row.price_type,
    currencyCode: row.currency_code,
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    staffIds: row.staff_services.map((s) => s.staff_id),
  };
}

/** Services not archived. RLS: the public sees only active services of published businesses. */
export async function listServices(db: Db, businessId: string): Promise<ServiceView[]> {
  const { data, error } = await db
    .from("services")
    .select(serviceSelect)
    .eq("business_id", businessId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (error) throw toAppError(error);
  return data.map(toView);
}

export async function getService(db: Db, businessId: string, serviceId: string): Promise<ServiceView | null> {
  const { data, error } = await db
    .from("services")
    .select(serviceSelect)
    .eq("business_id", businessId)
    .eq("id", serviceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw toAppError(error);
  }
  return data ? toView(data) : null;
}

export async function createService(
  db: Db,
  business: { id: string; currencyCode: string },
  input: ServiceInput,
): Promise<string> {
  const { count } = await db
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);
  const { data, error } = await db
    .from("services")
    .insert({
      business_id: business.id,
      name: input.name,
      description: input.description,
      price_minor: input.price,
      price_type: input.priceType,
      currency_code: business.currencyCode,
      duration_minutes: input.durationMinutes,
      is_active: input.isActive,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (error) throw toAppError(error);
  await setServiceStaff(db, data.id, input.staffIds);
  return data.id;
}

export async function updateService(db: Db, businessId: string, serviceId: string, input: ServiceInput): Promise<void> {
  const { data, error } = await db
    .from("services")
    .update({
      name: input.name,
      description: input.description,
      price_minor: input.price,
      price_type: input.priceType,
      duration_minutes: input.durationMinutes,
      is_active: input.isActive,
    })
    .eq("business_id", businessId)
    .eq("id", serviceId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That service no longer exists.");
  await setServiceStaff(db, serviceId, input.staffIds);
}

export async function setServiceStaff(db: Db, serviceId: string, staffIds: string[]): Promise<void> {
  const { error } = await db.rpc("set_service_staff", { p_service_id: serviceId, p_staff_ids: staffIds });
  if (error) throw toAppError(error);
}

/** Archive (soft delete): hidden everywhere, kept for past appointments. */
export async function archiveService(db: Db, businessId: string, serviceId: string): Promise<void> {
  const { data, error } = await db
    .from("services")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("business_id", businessId)
    .eq("id", serviceId)
    .select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That service no longer exists.");
}

/** Moves a service one place up or down in the list customers see. */
export async function moveService(
  db: Db,
  businessId: string,
  serviceId: string,
  direction: "up" | "down",
): Promise<void> {
  const services = await listServices(db, businessId);
  const index = services.findIndex((s) => s.id === serviceId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= services.length) return;
  const reordered = [...services];
  [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
  for (const [position, service] of reordered.entries()) {
    if (service.sortOrder === position) continue;
    const { error } = await db.from("services").update({ sort_order: position }).eq("id", service.id);
    if (error) throw toAppError(error);
  }
}
