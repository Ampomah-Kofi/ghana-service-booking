import type { Metadata } from "next";
import { BusinessHoursForm } from "@/components/business/hours-form";
import { StepHeader } from "@/components/ui/step-header";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getBusinessHours } from "@/server/businesses/schedule";

export const metadata: Metadata = { title: "Opening hours" };

export default async function HoursStepPage({ params }: PageProps<"/dashboard/[businessId]/setup/hours">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const hours = await getBusinessHours(db, business.id);
  return (
    <>
      <StepHeader
        businessId={business.id}
        step="hours"
        title="When are you open?"
        subtitle="We filled in Monday to Saturday, 9 to 6. Change anything that's different."
      />
      <BusinessHoursForm businessId={business.id} initial={hours} returnTo="setup" />
    </>
  );
}
