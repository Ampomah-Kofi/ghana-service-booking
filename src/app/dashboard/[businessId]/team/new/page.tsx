import type { Metadata } from "next";
import { StaffForm } from "@/components/business/staff-forms";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listServices } from "@/server/businesses/catalog";

export const metadata: Metadata = { title: "Add team member" };

export default async function NewStaffPage({ params }: PageProps<"/dashboard/[businessId]/team/new">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const services = await listServices(db, business.id);
  return (
    <>
      <h1 className="mb-4 text-display font-bold">Add team member</h1>
      <StaffForm
        businessId={business.id}
        services={services.map((s) => ({ id: s.id, name: s.name }))}
        values={{ displayName: "", roleTitle: "", bio: "", acceptsOnlineBookings: true, serviceIds: [] }}
      />
    </>
  );
}
