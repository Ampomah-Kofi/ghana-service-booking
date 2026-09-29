import { AppError } from "@/lib/errors";
import { apiMember } from "@/server/api/appointments";
import { apiError, json } from "@/server/api/http";
import { getInsights, parsePeriod } from "@/server/businesses/insights";

/**
 * GET /api/v1/businesses/{slug}/insights?days=7|30|90 (Bearer, owners and managers): the numbers
 * behind the Insights screen, in the business's timezone. Money in minor units.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/businesses/[slug]/insights">) {
  const { slug } = await params;
  try {
    const member = await apiMember(request, slug);
    if (!member.canManage) throw new AppError("NOT_FOUND", "Business not found.");
    const days = parsePeriod(new URL(request.url).searchParams.get("days"));
    const s = await getInsights(member.db, member.business.id, days);
    return json(
      {
        data: {
          period: { days: s.days, from: s.from, to: s.to, timezone: s.timezone },
          bookings: s.bookings,
          by_status: s.by_status,
          by_source: s.by_source,
          cancellation_rate: s.cancellationRate,
          no_show_rate: s.noShowRate,
          per_day: s.per_day,
          money: {
            currency: s.currency,
            recorded_minor: s.recorded_minor,
            refunded_minor: s.refunded_minor,
            completed_value_minor: s.completed_value_minor,
          },
          top_services: s.top_services,
          top_staff: s.top_staff,
          customers: s.customers,
        },
      },
      { personalised: true },
    );
  } catch (error) {
    return apiError(error);
  }
}
