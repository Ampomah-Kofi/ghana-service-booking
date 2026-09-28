import type { Metadata } from "next";
import { StepHeader } from "@/components/ui/step-header";
import { publicEnv } from "@/lib/public-env";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listActiveCategories } from "@/server/catalog/categories";
import { AboutForm, SlugForm } from "./about-form";

export const metadata: Metadata = { title: "About your business" };

export default async function AboutStepPage({ params }: PageProps<"/dashboard/[businessId]/setup/about">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const categories = await listActiveCategories(db);

  return (
    <>
      <StepHeader
        businessId={business.id}
        step="about"
        title="About your business"
        subtitle="The basics customers see first."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
        <AboutForm
          businessId={business.id}
          categories={categories.map(({ id, name }) => ({ id, name }))}
          values={{
            kind: business.kind,
            name: business.name,
            categoryId: business.category?.id ?? categories[0]?.id ?? "",
            description: business.description ?? "",
          }}
        />
        <SlugForm
          businessId={business.id}
          slug={business.slug}
          locked={business.publishedAt !== null}
          siteUrl={publicEnv().NEXT_PUBLIC_SITE_URL}
        />
      </div>
    </>
  );
}
