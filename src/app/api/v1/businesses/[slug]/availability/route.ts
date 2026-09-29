import type { z } from "zod";
import { AppError } from "@/lib/errors";
import { availabilityQuery, type availabilityResponse } from "@/schemas/api-v1";
import { apiClient, apiError, isPersonalised, json, validationError } from "@/server/api/http";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { getAvailability, getBookingSetup, lastBookableDate, todayIn } from "@/server/scheduling/availability";

/**
 * GET /api/v1/businesses/{slug}/availability?service_id=&staff_id=any&from=&days=7
 * Open start times, computed by the same engine as the website.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/businesses/[slug]/availability">) {
  const { slug } = await params;
  const parsed = availabilityQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const db = apiClient(request);
    const business = await getBusinessBySlug(db, slug);
    if (!business || business.status !== "published") throw new AppError("NOT_FOUND", "Business not found.");
    const setup = await getBookingSetup(db, business);
    const today = todayIn(setup.timezone);
    const last = lastBookableDate(setup);
    const from = parsed.data.from && parsed.data.from > today ? parsed.data.from : today;
    const days =
      from > last
        ? []
        : await getAvailability(db, setup, {
            serviceId: parsed.data.service_id,
            staffId: parsed.data.staff_id === "any" ? null : parsed.data.staff_id,
            fromDate: from,
            days: parsed.data.days,
          });
    const body: z.infer<typeof availabilityResponse> = {
      data: days
        .filter((d) => d.date <= last)
        .map((d) => ({
          date: d.date,
          slots: d.slots.map((s) => ({ starts_at: s.start.toISOString(), staff_ids: s.staffIds })),
        })),
      meta: { timezone: setup.timezone, last_bookable_date: last },
    };
    // Short cache: availability changes with every booking.
    return json(body, { cacheSeconds: 10, personalised: isPersonalised(request) });
  } catch (error) {
    return apiError(error);
  }
}
