import type { Metadata } from "next";
import { SOCIAL_LABELS, socialDisplay, socialHref, type SocialLinks } from "@/lib/social";
import { ReviewCard } from "@/components/reviews/review-card";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { FavoriteButton } from "@/components/marketplace/favorite-button";
import { listBusinessReviews, ratingSummary } from "@/server/reviews/reviews";
import { isFavorite } from "@/server/favorites/favorites";
import { getCurrentUser } from "@/server/auth/session";
import { PhotoCountChip, PhotoGallery } from "@/components/business/photo-viewer";
import { ShareButton } from "@/components/ui/share-button";
import { MorphCover } from "@/components/marketplace/business-card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SharePanel } from "@/components/business/share-panel";
import { publicMediaUrl } from "@/lib/images";
import { formatPhoneInternational } from "@/lib/phone";
import { publicEnv } from "@/lib/public-env";
import {
  buildShareLinks,
  businessPageUrl,
  mapsSearchUrl,
  mapsUrl,
  shareMessage,
  telUrl,
  whatsappChatUrl,
} from "@/lib/share";
import { formatPlace, getBusinessBySlug } from "@/server/businesses/queries";
import { listServices } from "@/server/businesses/catalog";
import { getBusinessHours } from "@/server/businesses/schedule";
import { listStaff } from "@/server/businesses/team";
import { describeWeek, formatDuration, openStatus } from "@/lib/hours";
import { formatMoney, formatPrice } from "@/lib/money";
import { ServiceRow } from "@/components/business/service-row";
import { Cover } from "@/components/marketplace/cover";
import { ChatIcon, ChevronLeftIcon, NavigationIcon, PhoneIcon, ShareIcon } from "@/components/ui/icons";
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
  const user = await getCurrentUser();
  const [allServices, allStaff, hours, summary, reviews, saved] = await Promise.all([
    listServices(db, business.id),
    listStaff(db, business.id, { withInvites: false }),
    getBusinessHours(db, business.id),
    ratingSummary(db, business.id),
    listBusinessReviews(db, business.id, { limit: 3, viewerId: user?.id ?? null }),
    user ? isFavorite(db, user.id, business.id) : Promise.resolve(null),
  ]);
  // Members previewing a draft also receive hidden items; show exactly what customers will see.
  const services = allServices.filter((s) => s.isActive);
  const team = allStaff.filter((s) => s.isActive);
  const staffName = new Map(team.map((s) => [s.id, s.displayName]));
  // Bookable online = published, and someone who takes online bookings performs it.
  const onlineStaff = new Set(team.filter((s) => s.acceptsOnlineBookings).map((s) => s.id));
  const bookable = (serviceIds: string[]) =>
    business.status === "published" && serviceIds.some((id) => onlineStaff.has(id));
  const canBook = services.some((s) => bookable(s.staffIds));
  const bookHref = (serviceId?: string) => `/business/${business.slug}/book${serviceId ? `?service=${serviceId}` : ""}`;
  const week = describeWeek(hours);

  const env = publicEnv();
  const media = (path: string) => publicMediaUrl(env.NEXT_PUBLIC_SUPABASE_URL, path);
  const pageUrl = businessPageUrl(env.NEXT_PUBLIC_SITE_URL, business.slug);
  const place = formatPlace(business.location);
  const cover = business.photos[0];
  const loc = business.location;

  const status = openStatus(hours, business.timezone);
  const socials = (Object.entries(business.social) as [keyof SocialLinks, string | null][]).filter(
    (e): e is [keyof SocialLinks, string] => e[1] !== null,
  );
  const directions =
    loc?.lat != null && loc.lng != null
      ? mapsUrl(loc.lat, loc.lng)
      : mapsSearchUrl([business.name, loc?.addressLine, place].filter(Boolean).join(", "));
  const actions = [
    business.phone ? { href: telUrl(business.phone), label: "Call", icon: <PhoneIcon />, external: false } : null,
    business.whatsapp
      ? {
          href: whatsappChatUrl(business.whatsapp),
          label: "WhatsApp",
          icon: <ChatIcon className="text-whatsapp" />,
          external: true,
        }
      : null,
    loc ? { href: directions, label: "Directions", icon: <NavigationIcon />, external: true } : null,
    business.status === "published" ? { href: "#share", label: "Share", icon: <ShareIcon />, external: false } : null,
  ].filter((a) => a !== null);

  return (
    <article>
      <header className="mb-5">
        <div className="bleed-top relative -mx-5 aspect-4/3 overflow-hidden bg-fill sm:mx-0 sm:rounded-card md:mt-0 md:aspect-video">
          <MorphCover id={business.id}>
            <div className="absolute inset-0">
              <Cover
                imageUrl={cover ? media(cover.pathLarge) : null}
                categorySlug={business.category?.slug ?? null}
                seed={business.id}
                eager
                iconScale={1.15}
              />
            </div>
          </MorphCover>
          <div className="absolute inset-x-0 top-0 flex justify-between p-3 pt-safe-sm">
            <Link
              href="/"
              aria-label="Back to explore"
              className="glass pressable flex size-11 items-center justify-center rounded-full text-ink"
            >
              <ChevronLeftIcon />
            </Link>
            {business.status === "published" ? (
              <div className="flex gap-2">
                <FavoriteButton
                  businessId={business.id}
                  businessName={business.name}
                  saved={saved}
                  className="glass size-11! text-ink"
                />
                <ShareButton
                  url={pageUrl}
                  title={business.name}
                  text={shareMessage(business.name, pageUrl)}
                  fallbackHref="#share"
                  label="Share"
                  className="glass pressable flex size-11 items-center justify-center rounded-full text-ink"
                >
                  <ShareIcon />
                </ShareButton>
              </div>
            ) : null}
          </div>
          {business.photos.length > 1 ? <PhotoCountChip count={business.photos.length} /> : null}
        </div>
        <div className="relative -mx-5 -mt-6 rounded-t-card bg-surface px-5 pt-5 sm:mx-0 sm:mt-0 sm:px-0">
          <div className="flex items-center gap-3.5">
            {business.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px logo
              <img
                src={media(business.logoPath)}
                alt=""
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-card object-cover lift"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="text-title font-bold">{business.name}</h1>
              <p className="truncate text-small text-ink-muted">
                {[business.category?.name, place].filter(Boolean).join(" · ")}
              </p>
            </div>
            {canBook ? (
              <Link
                href={bookHref()}
                className="pressable shrink-0 rounded-full bg-primary px-5 py-1.5 text-small font-bold text-on-primary hover:bg-primary-hover"
              >
                Book
              </Link>
            ) : null}
          </div>
          {/* App-store style facts strip: rating, opening, services. Labels always spelled out. */}
          <dl className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border py-3 text-center">
            {summary.count > 0 && summary.average !== null ? (
              <Stat
                label={summary.count === 1 ? "1 review" : `${summary.count} reviews`}
                value={`${summary.average.toFixed(1)} ★`}
              />
            ) : (
              <Stat label="Reviews" value="New" />
            )}
            {status ? (
              <Stat
                label={status.label.split(" · ")[1] ?? ""}
                value={status.label.split(" · ")[0]}
                tone={status.open ? "text-success" : undefined}
              />
            ) : (
              <Stat label="Hours" value="—" />
            )}
            <Stat label={services.length === 1 ? "Service" : "Services"} value={String(services.length)} />
          </dl>
        </div>
      </header>

      {business.status !== "published" ? (
        <p role="status" className="mb-4 rounded-control bg-fill px-3 py-2 text-small">
          <strong>Preview.</strong> Only your team can see this page.{" "}
          <Link href={`/dashboard/${business.id}/more`} className="font-medium text-primary">
            Publish it from your dashboard
          </Link>
        </p>
      ) : null}

      {actions.length > 0 ? (
        <nav aria-label="Contact" className="mb-7 grid grid-cols-4 gap-2">
          {actions.map((a) => (
            <a
              key={a.label}
              href={a.href}
              {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="pressable flex flex-col items-center gap-1.5 text-caption font-medium"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-fill text-primary">
                {a.icon}
              </span>
              {a.label}
            </a>
          ))}
        </nav>
      ) : null}

      {socials.length > 0 ? (
        <nav aria-label="Social media" className="mb-7">
          <ul className="rail -mx-5 flex gap-2 overflow-x-auto px-5">
            {socials.map(([kind, value]) => (
              <li key={kind} className="shrink-0">
                <a
                  href={socialHref(kind, value)}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="pressable inline-flex min-h-10 items-center gap-2 rounded-full bg-fill px-3.5 text-small font-medium hover:bg-ink/10"
                >
                  <span className="text-ink-muted">{SOCIAL_LABELS[kind]}</span>
                  <span className="max-w-40 truncate">{socialDisplay(kind, value)}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section className="mb-6" aria-labelledby="services-heading">
        <h2 id="services-heading" className="mb-2 text-title font-semibold">
          Services
        </h2>
        {services.length === 0 ? (
          <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">Services coming soon.</p>
        ) : (
          <ul className="ios-list overflow-hidden rounded-card bg-card lift">
            {services.map((s) => (
              <li key={s.id}>
                <ServiceRow
                  id={s.id}
                  photos={business.photos
                    .filter((p) => p.serviceId === s.id)
                    .map((p) => ({ small: media(p.pathSmall), large: media(p.pathLarge) }))}
                  href={bookable(s.staffIds) ? bookHref(s.id) : null}
                  name={s.name}
                  meta={[
                    formatDuration(s.durationMinutes),
                    business.kind === "team" && s.staffIds.length > 0
                      ? `with ${s.staffIds
                          .map((id) => staffName.get(id))
                          .filter(Boolean)
                          .join(", ")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  description={s.description}
                  price={formatPrice(s.priceMinor, s.priceType, business.currency)}
                  deposit={
                    s.depositMinor
                      ? `${formatMoney({ amountMinor: s.depositMinor, currency: business.currency.code }, business.currency)} deposit to book`
                      : null
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {services.length > 0 && !canBook ? (
          <p className="mt-2 text-small text-ink-muted">
            To book, call or message {business.phone ? formatPhoneInternational(business.phone) : "on WhatsApp"}.
          </p>
        ) : null}
      </section>

      {business.kind === "team" && team.length > 1 ? (
        <section className="mb-6" aria-labelledby="team-heading">
          <h2 id="team-heading" className="mb-2 text-title font-semibold">
            Team
          </h2>
          <ul className="flex gap-4 overflow-x-auto pb-1">
            {team.map((member) => (
              <li key={member.id} className="flex w-20 shrink-0 flex-col items-center text-center">
                <span
                  aria-hidden="true"
                  className="mb-1 flex size-14 items-center justify-center rounded-full bg-fill text-title font-semibold text-ink-muted"
                >
                  {member.displayName.charAt(0).toUpperCase()}
                </span>
                <span className="w-full truncate text-small font-medium">{member.displayName}</span>
                {member.roleTitle ? (
                  <span className="w-full truncate text-small text-ink-muted">{member.roleTitle}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-6" aria-labelledby="reviews-heading">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="reviews-heading" className="text-title font-semibold">
            Reviews
          </h2>
          {summary.count > reviews.length ? (
            <Link href={`/business/${business.slug}/reviews`} className="text-body text-primary">
              See all {summary.count}
            </Link>
          ) : null}
        </div>
        {summary.count === 0 ? (
          <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">
            No reviews yet. Reviews come only from customers who booked and visited.
          </p>
        ) : (
          <div className="overflow-hidden rounded-card bg-card lift">
            <div className="px-4 pt-4 pb-3">
              <RatingSummary summary={summary} />
            </div>
            <ul className="ios-list border-t border-border">
              {reviews.map((r) => (
                <li key={r.id}>
                  <ReviewCard review={r} businessName={business.name} canReport={Boolean(user) && !r.mine} />
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-2 px-1 text-small text-ink-muted">
          Only customers with a completed booking can leave a review.
        </p>
      </section>

      {business.description ? (
        <section className="mb-6" aria-labelledby="about-heading">
          <h2 id="about-heading" className="mb-2 text-title font-semibold">
            About
          </h2>
          <p className="whitespace-pre-line text-body">{business.description}</p>
        </section>
      ) : null}

      {loc ? (
        <section className="mb-6 rounded-card bg-card p-4 lift" aria-labelledby="where-heading">
          <h2 id="where-heading" className="mb-2 text-title font-semibold">
            Where to find us
          </h2>
          <address className="grid gap-1 text-body not-italic">
            {loc.addressLine ? <span>{loc.addressLine}</span> : null}
            {place ? <span>{[place, loc.regionName].filter(Boolean).join(", ")}</span> : null}
            {loc.landmark ? <span className="text-ink-muted">Landmark: {loc.landmark}</span> : null}
            {loc.directions ? <span className="text-ink-muted">{loc.directions}</span> : null}
          </address>
          {loc.lat !== null && loc.lng !== null ? (
            <a
              href={mapsUrl(loc.lat, loc.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center font-medium text-primary"
            >
              Open in Maps
            </a>
          ) : null}
        </section>
      ) : null}

      {hours.length > 0 ? (
        <section className="mb-6" aria-labelledby="hours-heading">
          <h2 id="hours-heading" className="mb-2 text-title font-semibold">
            Opening hours
          </h2>
          <dl className="ios-list overflow-hidden rounded-card bg-card lift">
            {week.map((day) => (
              <div key={day.day} className="flex justify-between gap-4 px-4 py-2.5 text-body">
                <dt>{day.label}</dt>
                <dd className={`text-right tabular-nums ${day.ranges.length ? "" : "text-ink-muted"}`}>
                  {day.ranges.length ? day.ranges.join(", ") : "Closed"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {business.photos.length > 0 ? (
        <section className="mb-6" aria-labelledby="work-heading">
          <h2 id="work-heading" className="mb-2 text-title font-semibold">
            Our work
          </h2>
          <PhotoGallery
            businessName={business.name}
            photos={business.photos.map((p) => ({ id: p.id, small: media(p.pathSmall), large: media(p.pathLarge) }))}
          />
        </section>
      ) : null}

      {business.status === "published" ? (
        <section id="share" className="mb-6 scroll-mt-4" aria-labelledby="share-heading">
          <h2 id="share-heading" className="mb-2 text-title font-semibold">
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

      {canBook ? (
        <div className="sticky bottom-0 z-10 -mx-1 pt-3 pb-safe-sm">
          <div className="glass rounded-full p-1.5">
            <Link
              href={bookHref()}
              className="pressable flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-body font-semibold text-on-primary hover:bg-primary-hover"
            >
              Book an appointment
            </Link>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse px-1">
      <dt className="truncate text-caption text-ink-muted">{label}</dt>
      <dd className={`text-heading font-bold ${tone ?? ""}`}>{value}</dd>
    </div>
  );
}
