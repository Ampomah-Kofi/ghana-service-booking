import { toApiAppointment } from "@/server/api/appointments";
import { apiError, apiUser, json } from "@/server/api/http";
import { listMyAppointments } from "@/server/bookings/appointments";

/** GET /api/v1/me/appointments (Bearer): the caller's bookings, upcoming (soonest first) and past. */
export async function GET(request: Request) {
  try {
    const { db, userId } = await apiUser(request);
    const { upcoming, past } = await listMyAppointments(db, userId);
    return json(
      { data: { upcoming: upcoming.map(toApiAppointment), past: past.map(toApiAppointment) } },
      { personalised: true },
    );
  } catch (error) {
    return apiError(error);
  }
}
