import type { Metadata } from "next";
import { StepHeader } from "@/components/ui/step-header";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listCitiesWithAreas } from "@/server/catalog/locations";
import { serverEnv } from "@/server/env";
import { LocationForm } from "./location-form";

export const metadata: Metadata = { title: "Location" };

export default async function LocationStepPage({ params }: PageProps<"/dashboard/[businessId]/setup/location">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const cities = await listCitiesWithAreas(db, serverEnv().DEFAULT_COUNTRY_CODE);
  const loc = business.location;

  return (
    <>
      <StepHeader
        businessId={business.id}
        step="location"
        title="Where are you?"
        subtitle="Customers use this to find you and to search nearby."
      />
      <LocationForm
        businessId={business.id}
        cities={cities}
        values={{
          cityId: loc?.cityId ?? "",
          areaId: loc?.areaId ?? "",
          localityText: loc?.localityText ?? "",
          addressLine: loc?.addressLine ?? "",
          landmark: loc?.landmark ?? "",
          directions: loc?.directions ?? "",
          lat: loc?.lat ?? null,
          lng: loc?.lng ?? null,
        }}
      />
    </>
  );
}
