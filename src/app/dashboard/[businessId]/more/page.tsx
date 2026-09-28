import type { Metadata } from "next";
import { LargeTitle } from "@/components/ui/large-title";
import Link from "next/link";
import { GroupedSection } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { SharePanel } from "@/components/business/share-panel";
import { SETUP_STEPS } from "@/components/ui/step-header";
import { formatPhoneInternational } from "@/lib/phone";
import { publicEnv } from "@/lib/public-env";
import { buildShareLinks, businessPageUrl, shareMessage } from "@/lib/share";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getPublishReadiness } from "@/server/businesses/onboarding";
import { formatPlace } from "@/server/businesses/queries";
import { qrDataUrl } from "@/server/businesses/qr";
import { PublishButton, UnpublishButton } from "../publish-controls";

export const metadata: Metadata = { title: "More" };

type ChecklistItem = { label: string; detail: string; done: boolean; required: boolean; href: string };

export default async function MorePage({ params }: PageProps<"/dashboard/[businessId]/more">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const missing = await getPublishReadiness(db, business.id);
  const contactNumber = business.phone ?? business.whatsapp;
  const setup = (step: (typeof SETUP_STEPS)[number]["slug"]) => `/dashboard/${business.id}/setup/${step}`;

  const checklist: ChecklistItem[] = [
    {
      label: "Name and category",
      detail: business.category?.name ?? "Choose a category",
      done: !missing.includes("category"),
      required: true,
      href: setup("about"),
    },
    {
      label: "Location",
      detail: formatPlace(business.location) ?? "Where customers find you",
      done: !missing.includes("location"),
      required: true,
      href: setup("location"),
    },
    {
      label: "Contact",
      detail: contactNumber ? formatPhoneInternational(contactNumber) : "Phone or WhatsApp",
      done: !missing.includes("contact"),
      required: true,
      href: setup("contact"),
    },
    {
      label: "Services",
      detail: missing.includes("services") ? "Add at least one service someone performs" : "Added",
      done: !missing.includes("services"),
      required: true,
      href: `/dashboard/${business.id}/services`,
    },
    {
      label: "Opening hours",
      detail: missing.includes("hours") ? "Set when you're open" : "Set",
      done: !missing.includes("hours"),
      required: true,
      href: `/dashboard/${business.id}/hours`,
    },
    {
      label: "Description",
      detail: business.description ? "Added" : "Tell customers about you",
      done: business.description !== null,
      required: false,
      href: setup("about"),
    },
    {
      label: "Logo",
      detail: business.logoPath ? "Added" : "Recommended",
      done: business.logoPath !== null,
      required: false,
      href: setup("photos"),
    },
    {
      label: "Portfolio photos",
      detail: `${business.photos.length} added`,
      done: business.photos.length > 0,
      required: false,
      href: setup("photos"),
    },
  ];

  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  const pageUrl = businessPageUrl(siteUrl, business.slug);
  const published = business.status === "published";
  const qr = published ? await qrDataUrl(pageUrl) : null;

  return (
    <>
      <LargeTitle title="More" className="mb-1" />
      <p className="mb-6 text-body text-ink-muted">
        {published
          ? "Your page is live. Customers can book you online."
          : business.status === "draft"
            ? "Finish the required items, then publish your page."
            : `This business is ${business.status}. Contact support to restore it.`}
      </p>

      <GroupedSection title="Manage">
        {[
          {
            href: `/dashboard/${business.id}/reviews`,
            label: "Reviews",
            detail: "Read and reply to what customers say",
          },
          { href: `/dashboard/${business.id}/services`, label: "Services", detail: "Prices, durations, who does what" },
          ...(business.kind === "team"
            ? [{ href: `/dashboard/${business.id}/team`, label: "Team", detail: "People, invites, their hours" }]
            : []),
          { href: `/dashboard/${business.id}/hours`, label: "Opening hours", detail: "Your week, with breaks" },
          { href: `/dashboard/${business.id}/time-off`, label: "Time off", detail: "Holidays, days off, breaks" },
          { href: `/dashboard/${business.id}/settings`, label: "Booking rules", detail: "Notice, gaps, cancellations" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill">
            <span className="min-w-0 flex-1">
              <span className="block text-body">{item.label}</span>
              <span className="block truncate text-small text-ink-muted">{item.detail}</span>
            </span>
            <ChevronRightIcon className="shrink-0 text-ink-muted" />
          </Link>
        ))}
      </GroupedSection>

      <GroupedSection title="Your page">
        {checklist.map((item) => (
          <Link key={item.label} href={item.href} className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-fill">
            <span
              aria-hidden="true"
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-small font-bold ${
                item.done
                  ? "bg-success text-white"
                  : item.required
                    ? "border-2 border-danger"
                    : "border-2 border-border"
              }`}
            >
              {item.done ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body">
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : item.required ? " (required)" : " (optional)"}</span>
              </span>
              <span className="block truncate text-small text-ink-muted">{item.detail}</span>
            </span>
            <span aria-hidden="true" className="text-ink-muted">
              ›
            </span>
          </Link>
        ))}
      </GroupedSection>

      {business.status === "draft" ? (
        <section className="mb-8 grid gap-3">
          <PublishButton businessId={business.id} ready={missing.length === 0} />
          <p className="text-center text-small text-ink-muted">
            {missing.length === 0 ? "Everything required is done." : `Still needed: ${missing.join(", ")}.`}{" "}
            <Link href={`/business/${business.slug}`} className="font-medium text-primary">
              Preview your page
            </Link>
          </p>
        </section>
      ) : null}

      {published ? (
        <>
          <GroupedSection title="Share your page">
            <div className="p-4">
              <SharePanel
                url={pageUrl}
                title={business.name}
                text={shareMessage(business.name, pageUrl)}
                links={buildShareLinks(business.name, pageUrl)}
              />
            </div>
          </GroupedSection>
          <GroupedSection
            title="QR code"
            footer="Print it for your shop window or mirror. Customers scan it to open your page."
          >
            <div className="flex flex-col items-center gap-3 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- inline data URL generated on the server */}
              <img
                src={qr ?? ""}
                alt={`QR code for ${pageUrl}`}
                width={200}
                height={200}
                className="size-50 rounded-control"
              />
              <a
                href={`/business/${business.slug}/qr`}
                className="min-h-11 content-center text-body font-medium text-primary"
                download
              >
                Download QR code (PNG)
              </a>
            </div>
          </GroupedSection>
          <UnpublishButton businessId={business.id} />
        </>
      ) : null}
    </>
  );
}
