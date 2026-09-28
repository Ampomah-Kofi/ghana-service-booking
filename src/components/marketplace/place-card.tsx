import Link from "next/link";
import { publicMediaUrl } from "@/lib/images";
import { formatDateShort } from "@/lib/datetime";
import { rebookHref } from "@/lib/rebook";
import type { Place } from "@/server/bookings/places";
import { Cover } from "./cover";

/** A place you've been: tap the card for the business, or "Book again" for the same service and person. */
export function PlaceCard({ place, supabaseUrl }: { place: Place; supabaseUrl: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card bg-card lift">
      <Link href={`/business/${place.slug}`} className="pressable flex items-center gap-3 p-3">
        <span className="size-14 shrink-0 overflow-hidden rounded-control">
          <Cover
            imageUrl={place.imagePath ? publicMediaUrl(supabaseUrl, place.imagePath) : null}
            categorySlug={place.categorySlug}
            seed={place.businessId}
            iconScale={1.6}
          />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-body font-semibold">{place.name}</span>
          <span className="block truncate text-small text-ink-muted">
            {place.lastServiceName} · {place.upcoming ? "booked" : "last"}{" "}
            {formatDateShort(place.lastVisitAt, place.timezone)}
          </span>
        </span>
      </Link>
      <Link
        href={rebookHref(place.slug, place.lastServiceId, place.lastStaffId)}
        className="pressable mx-3 mb-3 flex min-h-11 items-center justify-center rounded-full bg-primary-soft text-small font-semibold text-primary hover:bg-primary hover:text-on-primary"
      >
        Book again
      </Link>
    </div>
  );
}
