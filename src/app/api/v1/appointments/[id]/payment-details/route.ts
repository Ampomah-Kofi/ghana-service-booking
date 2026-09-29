import { AppError } from "@/lib/errors";
import { paymentReference } from "@/lib/payment-methods";
import { apiError, apiUser, json, uuidParam } from "@/server/api/http";
import { getAppointment } from "@/server/bookings/appointments";
import { getBookingPaymentDetails } from "@/server/payments/service";

/**
 * GET /api/v1/appointments/{id}/payment-details (Bearer, the booking's customer or the business):
 * where to send Mobile Money or a bank transfer to the business, for the method the customer chose.
 */
export async function GET(request: Request, { params }: RouteContext<"/api/v1/appointments/[id]/payment-details">) {
  const { id } = await params;
  try {
    const { db } = await apiUser(request);
    uuidParam(id, "Booking not found.");
    const appointment = await getAppointment(db, id);
    if (!appointment) throw new AppError("NOT_FOUND", "Booking not found.");
    const details = await getBookingPaymentDetails(db, id);
    return json(
      {
        data: {
          reference: paymentReference(id),
          mobile_money: details?.momo ?? null,
          bank: details?.bank
            ? {
                bank_name: details.bank.bankName,
                account_name: details.bank.accountName,
                account_number: details.bank.accountNumber,
              }
            : null,
        },
      },
      { personalised: true },
    );
  } catch (error) {
    return apiError(error);
  }
}
