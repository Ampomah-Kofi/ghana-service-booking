import type { Metadata } from "next";
import { BusinessHoursForm } from "@/components/business/hours-form";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getBusinessHours } from "@/server/businesses/schedule";

export const metadata: Metadata = { title: "Opening hours" };

export default async function HoursPage({ params }: PageProps<"/dashboard/[businessId]/hours">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const hours = await getBusinessHours(db, business.id);
  return (
    <>
      <h1 className="text-display font-bold">Opening hours</h1>
      <p className="mb-5 mt-2 text-body text-ink-muted">
        Add a break to close for lunch.{" "}
        {business.kind === "team" ? "Team members can have their own hours inside these." : ""} Times are in{" "}
        {business.timezone.replace("_", " ")} time.
      </p>
      <BusinessHoursForm businessId={business.id} initial={hours} />
    </>
  );
}
