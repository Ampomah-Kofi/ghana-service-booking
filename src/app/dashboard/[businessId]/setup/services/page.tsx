import type { Metadata } from "next";
import Link from "next/link";
import { ServiceList } from "@/components/business/service-list";
import { StepHeader, nextStepHref } from "@/components/ui/step-header";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listServices } from "@/server/businesses/catalog";
import { listStaff } from "@/server/businesses/team";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesStepPage({ params }: PageProps<"/dashboard/[businessId]/setup/services">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const [services, staff] = await Promise.all([
    listServices(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
  ]);

  return (
    <>
      <StepHeader
        businessId={business.id}
        step="services"
        title="What do you offer?"
        subtitle="Add at least one thing you do, how long it takes, and its price (or “on request”)."
      />
      <ServiceList
        businessId={business.id}
        services={services}
        currency={business.currency}
        staffNames={business.kind === "team" ? new Map(staff.map((s) => [s.id, s.displayName])) : null}
        editQuery="?returnTo=setup"
      />
      <Link
        href={`/dashboard/${business.id}/services/new?returnTo=setup`}
        className="mt-3 flex min-h-11 items-center justify-center rounded-control bg-fill text-body font-medium text-primary"
      >
        {services.length === 0 ? "Add your first service" : "Add another service"}
      </Link>
      <Link
        href={nextStepHref(business.id, "services")}
        aria-disabled={services.length === 0}
        className={`mt-6 flex min-h-11 items-center justify-center rounded-control px-4 text-body font-semibold ${
          services.length === 0
            ? "pointer-events-none bg-fill text-ink-muted"
            : "bg-primary text-on-primary hover:bg-primary-hover"
        }`}
      >
        Continue
      </Link>
    </>
  );
}
