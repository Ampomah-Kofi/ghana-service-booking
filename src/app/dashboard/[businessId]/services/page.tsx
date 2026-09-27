import type { Metadata } from "next";
import Link from "next/link";
import { ServiceList } from "@/components/business/service-list";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listServices } from "@/server/businesses/catalog";
import { listStaff } from "@/server/businesses/team";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage({ params }: PageProps<"/dashboard/[businessId]/services">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const [services, staff] = await Promise.all([
    listServices(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
  ]);

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-display font-bold tracking-tight">Services</h1>
        <Link
          href={`/dashboard/${business.id}/services/new`}
          className="min-h-11 content-center font-medium text-primary"
        >
          Add service
        </Link>
      </div>
      <ServiceList
        businessId={business.id}
        services={services}
        currency={business.currency}
        staffNames={business.kind === "team" ? new Map(staff.map((s) => [s.id, s.displayName])) : null}
      />
      <p className="mt-3 text-small text-ink-muted">Use the arrows to set the order customers see.</p>
    </>
  );
}
