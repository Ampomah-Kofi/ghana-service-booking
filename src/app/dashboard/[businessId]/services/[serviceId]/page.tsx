import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/business/service-form";
import { minorToInput } from "@/lib/money";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getService } from "@/server/businesses/catalog";
import { listStaff } from "@/server/businesses/team";
import { archiveServiceAction } from "../actions";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/services/[serviceId]">) {
  const { businessId, serviceId } = await params;
  const { returnTo } = await searchParams;
  const { db, business } = await managedBusinessOr404(businessId);
  const [service, staff] = await Promise.all([
    getService(db, business.id, serviceId),
    listStaff(db, business.id, { withInvites: false }),
  ]);
  if (!service) notFound();
  const unit = business.currency.minorUnit;
  const back = returnTo === "setup" ? "setup" : "services";

  return (
    <>
      <h1 className="mb-4 text-display font-bold">{service.name}</h1>
      <ServiceForm
        businessId={business.id}
        serviceId={service.id}
        returnTo={back}
        currencySymbol={business.currency.symbol}
        staff={business.kind === "team" ? staff.map((s) => ({ id: s.id, name: s.displayName })) : null}
        values={{
          name: service.name,
          description: service.description ?? "",
          price: minorToInput(service.priceMinor, unit),
          priceType: service.priceType,
          durationMinutes: service.durationMinutes,
          isActive: service.isActive,
          staffIds: service.staffIds,
        }}
      />
      <form action={archiveServiceAction} className="mt-6">
        <input type="hidden" name="businessId" value={business.id} />
        <input type="hidden" name="serviceId" value={service.id} />
        <input type="hidden" name="returnTo" value={back} />
        <button type="submit" className="min-h-11 w-full rounded-card bg-card text-body text-danger lift">
          Delete service
        </button>
        <p className="mt-2 text-center text-small text-ink-muted">Past bookings keep their details.</p>
      </form>
    </>
  );
}
