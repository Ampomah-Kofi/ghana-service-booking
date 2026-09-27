import type { Metadata } from "next";
import Link from "next/link";
import { GroupedSection } from "@/components/ui/card";
import { SharePanel } from "@/components/business/share-panel";
import { SETUP_STEPS } from "@/components/ui/step-header";
import { formatPhoneInternational } from "@/lib/phone";
import { publicEnv } from "@/lib/public-env";
import { buildShareLinks, businessPageUrl, shareMessage } from "@/lib/share";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { getPublishReadiness } from "@/server/businesses/onboarding";
import { formatPlace } from "@/server/businesses/queries";
import { qrDataUrl } from "@/server/businesses/qr";
import { PublishButton, UnpublishButton } from "./publish-controls";

export const metadata: Metadata = { title: "Dashboard" };

type ChecklistItem = { label: string; detail: string; done: boolean; required: boolean; href: string };

export default async function BusinessDashboardPage({ params }: PageProps<"/dashboard/[businessId]">) {
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
      <h1 className="mb-1 text-large-title font-bold tracking-tight">
        {published ? "Your page is live" : "Almost there"}
      </h1>
      <p className="mb-6 text-body text-text-secondary">
        {published
          ? "Share your link so customers can find you. Services and booking arrive next."
          : business.status === "draft"
            ? "Finish the required items, then publish your page."
            : `This business is ${business.status}. Contact support to restore it.`}
      </p>

      <GroupedSection title="Your page">
        {checklist.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex min-h-11 items-center gap-3 border-b border-separator px-4 py-3 last:border-b-0 hover:bg-fill"
          >
            <span
              aria-hidden="true"
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-footnote font-bold ${
                item.done
                  ? "bg-success text-white"
                  : item.required
                    ? "border-2 border-danger"
                    : "border-2 border-separator"
              }`}
            >
              {item.done ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body">
                {item.label}
                <span className="sr-only">{item.done ? " (done)" : item.required ? " (required)" : " (optional)"}</span>
              </span>
              <span className="block truncate text-footnote text-text-secondary">{item.detail}</span>
            </span>
            <span aria-hidden="true" className="text-text-secondary">
              ›
            </span>
          </Link>
        ))}
      </GroupedSection>

      {business.status === "draft" ? (
        <section className="mb-8 grid gap-3">
          <PublishButton businessId={business.id} ready={missing.length === 0} />
          <p className="text-center text-footnote text-text-secondary">
            {missing.length === 0 ? "Everything required is done." : `Still needed: ${missing.join(", ")}.`}{" "}
            <Link href={`/business/${business.slug}`} className="font-medium text-accent">
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
                className="min-h-11 content-center text-body font-medium text-accent"
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
