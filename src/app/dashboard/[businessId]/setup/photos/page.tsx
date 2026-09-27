import type { Metadata } from "next";
import Link from "next/link";
import { StepHeader } from "@/components/ui/step-header";
import { IMAGE_LIMITS, publicMediaUrl } from "@/lib/images";
import { publicEnv } from "@/lib/public-env";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { deletePhotoAction, removeLogoAction } from "../../actions";
import { LogoUpload, PhotoUpload } from "./photo-uploads";

export const metadata: Metadata = { title: "Photos" };

export default async function PhotosStepPage({ params }: PageProps<"/dashboard/[businessId]/setup/photos">) {
  const { businessId } = await params;
  const { business } = await managedBusinessOr404(businessId);
  const supabaseUrl = publicEnv().NEXT_PUBLIC_SUPABASE_URL;

  return (
    <>
      <StepHeader
        businessId={business.id}
        step="photos"
        title="Show your work"
        subtitle="Good photos are the biggest reason customers book. Both are optional."
      />

      <section className="mb-8 rounded-card bg-card p-5 border border-border" aria-labelledby="logo-heading">
        <h2 id="logo-heading" className="mb-3 text-title font-semibold">
          Logo or profile photo
        </h2>
        <div className="flex items-center gap-4">
          {business.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- already resized to 400px on upload; no optimisation needed
            <img
              src={publicMediaUrl(supabaseUrl, business.logoPath)}
              alt={`${business.name} logo`}
              width={72}
              height={72}
              className="size-18 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex size-18 items-center justify-center rounded-full bg-fill text-title font-semibold text-ink-muted"
              aria-hidden="true"
            >
              {business.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col items-start gap-1">
            <LogoUpload businessId={business.id} hasLogo={business.logoPath !== null} />
            {business.logoPath ? (
              <form action={removeLogoAction}>
                <input type="hidden" name="businessId" value={business.id} />
                <button type="submit" className="min-h-11 text-small text-danger">
                  Remove logo
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-8" aria-labelledby="portfolio-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="portfolio-heading" className="text-title font-semibold">
            Portfolio
          </h2>
          <span className="text-small text-ink-muted">
            {business.photos.length} of {IMAGE_LIMITS.maxPortfolioPhotos}
          </span>
        </div>
        <ul className="grid grid-cols-3 gap-2">
          {business.photos.map((photo) => (
            <li key={photo.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px rendition */}
              <img
                src={publicMediaUrl(supabaseUrl, photo.pathSmall)}
                alt=""
                width={400}
                height={400}
                loading="lazy"
                className="aspect-square w-full rounded-control object-cover"
              />
              <form action={deletePhotoAction} className="absolute right-1 top-1">
                <input type="hidden" name="businessId" value={business.id} />
                <input type="hidden" name="photoId" value={photo.id} />
                <button
                  type="submit"
                  aria-label="Remove photo"
                  className="flex size-8 items-center justify-center rounded-full bg-black/60 text-small text-white backdrop-blur"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
          <li>
            <PhotoUpload businessId={business.id} count={business.photos.length} />
          </li>
        </ul>
        <p className="mt-2 text-small text-ink-muted">
          Photos are resized on your phone before uploading, to save data.
        </p>
      </section>

      <Link
        href={`/dashboard/${business.id}/more?setup=done`}
        className="flex min-h-11 w-full items-center justify-center rounded-control bg-primary px-4 text-body font-semibold text-on-primary hover:bg-primary-hover"
      >
        Finish and preview
      </Link>
    </>
  );
}
