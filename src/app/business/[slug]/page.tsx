import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SharePanel } from "@/components/business/share-panel";
import { publicMediaUrl } from "@/lib/images";
import { formatPhoneInternational } from "@/lib/phone";
import { publicEnv } from "@/lib/public-env";
import { buildShareLinks, businessPageUrl, mapsUrl, shareMessage, telUrl, whatsappChatUrl } from "@/lib/share";
import { formatPlace, getBusinessBySlug } from "@/server/businesses/queries";
import { listServices } from "@/server/businesses/catalog";
import { getBusinessHours } from "@/server/businesses/schedule";
import { listStaff } from "@/server/businesses/team";
import { describeWeek, formatDuration } from "@/lib/hours";
import { formatMoney } from "@/lib/money";
import { createUserClient } from "@/server/db/supabase-server";

// RLS decides visibility: everyone sees published pages; the business's team also sees drafts (preview).
const loadBusiness = cache(async (slug: string) => getBusinessBySlug(await createUserClient(), slug));

export async function generateMetadata({ params }: PageProps<"/business/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadBusiness(slug);
  if (!business) return { title: "Not found" };
  const place = formatPlace(business.location);
  const description =
    business.description?.slice(0, 160) ?? [business.category?.name, place].filter(Boolean).join(" · ");
  const image = business.photos[0]?.pathLarge ?? business.logoPath;
  const env = publicEnv();
  return {
    title: business.name,
    description,
    robots: business.status === "published" ? undefined : { index: false, follow: false },
    alternates: { canonical: businessPageUrl(env.NEXT_PUBLIC_SITE_URL, business.slug) },
    openGraph: {
      title: business.name,
      description,
      url: businessPageUrl(env.NEXT_PUBLIC_SITE_URL, business.slug),
      type: "website",
      images: image ? [{ url: publicMediaUrl(env.NEXT_PUBLIC_SUPABASE_URL, image) }] : undefined,
    },
  };
}

export default async function BusinessPage({ params }: PageProps<"/business/[slug]">) {
  const { slug } = await params;
  const business = await loadBusiness(slug);
  if (!business) notFound();

  const db = await createUserClient();
  const [allServices, allStaff, hours] = await Promise.all([
    listServices(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
    getBusinessHours(db, business.id),
  ]);
  // Members previewing a draft also receive hidden items; show exactly what customers will see.
  const services = allServices.filter((s) => s.isActive);
  const team = allStaff.filter((s) => s.isActive);
  const staffName = new Map(team.map((s) => [s.id, s.displayName]));
  const week = describeWeek(hours);

  const env = publicEnv();
  const media = (path: string) => publicMediaUrl(env.NEXT_PUBLIC_SUPABASE_URL, path);
  const pageUrl = businessPageUrl(env.NEXT_PUBLIC_SITE_URL, business.slug);
  const place = formatPlace(business.location);
  const cover = business.photos[0];
  const loc = business.location;

  return (
    <article className="-mt-2">
      {business.status !== "published" ? (
        <p role="status" className="mb-4 rounded-control bg-fill px-3 py-2 text-callout">
          <strong>Preview.</strong> Only your team can see this page.{" "}
          <Link href={`/dashboard/${business.id}`} className="font-medium text-accent">
            Publish it from your dashboard
          </Link>
        </p>
      ) : null}

      <header className="mb-6">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- pre-sized 1200px rendition from upload
          <img
            src={media(cover.pathLarge)}
            alt=""
            width={cover.width ?? 1200}
            height={cover.height ?? 800}
            fetchPriority="high"
            className="-mx-4 mb-4 aspect-[4/3] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-card"
          />
        ) : null}
        <div className="flex items-center gap-4">
          {business.logoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px logo
            <img
              src={media(business.logoPath)}
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-full object-cover shadow-card"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-title-1 font-bold tracking-tight">{business.name}</h1>
            <p className="text-callout text-text-secondary">
              {[business.category?.name, place].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-2" aria-label="Contact">
        {business.phone ? (
          <a
            href={telUrl(business.phone)}
            className="flex min-h-11 items-center justify-center rounded-control bg-accent px-3 text-body font-semibold text-on-accent"
          >
            Call
          </a>
        ) : null}
        {business.whatsapp ? (
          <a
            href={whatsappChatUrl(business.whatsapp)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center rounded-control bg-surface-elevated px-3 text-body font-semibold text-accent shadow-card"
          >
            WhatsApp
          </a>
        ) : null}
      </section>

      <section className="mb-6" aria-labelledby="services-heading">
        <h2 id="services-heading" className="mb-2 text-title-2 font-semibold">
          Services
        </h2>
        {services.length === 0 ? (
          <p className="rounded-card bg-surface-elevated p-4 text-body text-text-secondary shadow-card">
            Services coming soon.
          </p>
        ) : (
          <ul className="divide-y divide-separator overflow-hidden rounded-card bg-surface-elevated shadow-card">
            {services.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-body font-medium">{s.name}</p>
                  <p className="text-footnote text-text-secondary">
                    {formatDuration(s.durationMinutes)}
                    {business.kind === "team" && s.staffIds.length > 0
                      ? ` · with ${s.staffIds
                          .map((id) => staffName.get(id))
                          .filter(Boolean)
                          .join(", ")}`
                      : ""}
                  </p>
                  {s.description ? <p className="mt-1 text-footnote text-text-secondary">{s.description}</p> : null}
                </div>
                <p className="shrink-0 text-body font-semibold tabular-nums">
                  {s.priceType === "from" ? (
                    <span className="text-footnote font-normal text-text-secondary">from </span>
                  ) : null}
                  {formatMoney({ amountMinor: s.priceMinor, currency: s.currencyCode }, business.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-footnote text-text-secondary">
          Online booking is coming soon. For now, call or message{" "}
          {business.phone ? formatPhoneInternational(business.phone) : "on WhatsApp"} to book.
        </p>
      </section>

      {business.kind === "team" && team.length > 1 ? (
        <section className="mb-6" aria-labelledby="team-heading">
          <h2 id="team-heading" className="mb-2 text-title-2 font-semibold">
            Team
          </h2>
          <ul className="flex gap-4 overflow-x-auto pb-1">
            {team.map((member) => (
              <li key={member.id} className="flex w-20 shrink-0 flex-col items-center text-center">
                <span
                  aria-hidden="true"
                  className="mb-1 flex size-14 items-center justify-center rounded-full bg-surface-elevated text-title-2 font-semibold text-text-secondary shadow-card"
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="w-full truncate text-footnote font-medium">{member.displayName}</span>
                {member.roleTitle ? (
                  <span className="w-full truncate text-footnote text-text-secondary">{member.roleTitle}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {business.description ? (
        <section className="mb-6" aria-labelledby="about-heading">
          <h2 id="about-heading" className="mb-2 text-title-2 font-semibold">
            About
          </h2>
          <p className="whitespace-pre-line text-body">{business.description}</p>
        </section>
      ) : null}

      {loc ? (
        <section className="mb-6 rounded-card bg-surface-elevated p-4 shadow-card" aria-labelledby="where-heading">
          <h2 id="where-heading" className="mb-2 text-title-2 font-semibold">
            Where to find us
          </h2>
          <address className="grid gap-1 text-body not-italic">
            {loc.addressLine ? <span>{loc.addressLine}</span> : null}
            {place ? <span>{[place, loc.regionName].filter(Boolean).join(", ")}</span> : null}
            {loc.landmark ? <span className="text-text-secondary">Landmark: {loc.landmark}</span> : null}
            {loc.directions ? <span className="text-text-secondary">{loc.directions}</span> : null}
          </address>
          {loc.lat !== null && loc.lng !== null ? (
            <a
              href={mapsUrl(loc.lat, loc.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center font-medium text-accent"
            >
              Open in Maps
            </a>
          ) : null}
        </section>
      ) : null}

      {hours.length > 0 ? (
        <section className="mb-6" aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="mb-2 text-title-2 font-semibold">
            Opening hours
          </h2>
          <dl className="divide-y divide-separator overflow-hidden rounded-card bg-surface-elevated shadow-card">
            {week.map((day) => (
              <div key={day.day} className="flex justify-between gap-4 px-4 py-2.5 text-body">
                <dt>{day.label}</dt>
                <dd className={`text-right tabular-nums ${day.ranges.length ? "" : "text-text-secondary"}`}>
                  {day.ranges.length ? day.ranges.join(", ") : "Closed"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {business.photos.length > 0 ? (
        <section className="mb-6" aria-labelledby="work-heading">
          <h2 id="work-heading" className="mb-2 text-title-2 font-semibold">
            Our work
          </h2>
          <ul className="grid grid-cols-3 gap-1.5">
            {business.photos.map((photo) => (
              <li key={photo.id}>
                <a href={media(photo.pathLarge)} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px rendition */}
                  <img
                    src={media(photo.pathSmall)}
                    alt={`Work by ${business.name}`}
                    width={400}
                    height={400}
                    loading="lazy"
                    className="aspect-square w-full rounded-control object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {business.status === "published" ? (
        <section className="mb-6" aria-labelledby="share-heading">
          <h2 id="share-heading" className="mb-2 text-title-2 font-semibold">
            Share
          </h2>
          <SharePanel
            url={pageUrl}
            title={business.name}
            text={shareMessage(business.name, pageUrl)}
            links={buildShareLinks(business.name, pageUrl)}
          />
        </section>
      ) : null}
    </article>
  );
}
