import type { Metadata } from "next";
import { ServiceForm } from "@/components/business/service-form";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listStaff } from "@/server/businesses/team";

export const metadata: Metadata = { title: "Add a service" };

export default async function NewServicePage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/services/new">) {
  const { businessId } = await params;
  const { returnTo } = await searchParams;
  const { db, business } = await managedBusinessOr404(businessId);
  const staff = await listStaff(db, business.id, { withInvites: false });

  return (
    <>
      <h1 className="mb-4 text-display font-bold">Add a service</h1>
      <ServiceForm
        businessId={business.id}
        returnTo={returnTo === "setup" ? "setup" : "services"}
        currencySymbol={business.currency.symbol}
        staff={business.kind === "team" ? staff.map((s) => ({ id: s.id, name: s.displayName })) : null}
        values={{
          name: "",
          description: "",
          price: "",
          priceType: "fixed",
          durationMinutes: 30,
          isActive: true,
          staffIds: staff.map((s) => s.id),
        }}
      />
    </>
  );
}
