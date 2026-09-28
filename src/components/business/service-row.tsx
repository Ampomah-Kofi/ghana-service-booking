import Link from "next/link";
import { Sheet } from "@/components/ui/sheet";
import { ChevronRightIcon, InfoIcon } from "@/components/ui/icons";

/**
 * A service in a price list. The row books; when there's more to say (description, deposit),
 * an ⓘ button opens a bottom sheet with the details and a Book button (ADR-0012).
 */
export function ServiceRow({
  id,
  href,
  name,
  meta,
  description,
  price,
  deposit,
  photos = [],
}: {
  id: string;
  href: string | null;
  name: string;
  meta: string;
  description?: string | null;
  price: string;
  deposit?: string | null;
  /** Portfolio photos tagged with this service (Phase 7). */
  photos?: { small: string; large: string }[];
}) {
  const hasDetails = Boolean(description || deposit || photos.length > 0);
  const sheetId = `service-${id}`;
  // "Price on request" is words, not a figure: smaller and allowed to wrap, so it never squeezes the name.
  const worded = !/\d/.test(price);
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium break-words">{name}</span>
        <span className="block text-small text-ink-muted">{meta}</span>
        {description ? (
          <span className="mt-0.5 line-clamp-1 block text-small text-ink-muted">{description}</span>
        ) : null}
        {deposit ? <span className="mt-0.5 block text-small text-warning">{deposit}</span> : null}
        {photos.length > 0 ? (
          <span className="mt-2 flex gap-1.5" aria-hidden="true">
            {photos.slice(0, 3).map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px rendition
              <img
                key={p.small}
                src={p.small}
                alt=""
                width={44}
                height={44}
                loading="lazy"
                className="size-11 rounded-inner object-cover"
              />
            ))}
            {photos.length > 3 ? (
              <span className="flex size-11 items-center justify-center rounded-inner bg-fill text-caption font-semibold text-ink-muted">
                +{photos.length - 3}
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
      <span
        className={
          worded
            ? "max-w-[7.5rem] shrink-0 text-right text-small leading-tight font-medium text-ink-muted"
            : "shrink-0 text-heading font-semibold tabular-nums"
        }
      >
        {price}
      </span>
      {href && !hasDetails ? <ChevronRightIcon className="shrink-0 text-ink-muted" /> : null}
    </>
  );
  const className = "flex min-h-14 flex-1 items-center gap-3 py-3 pl-4";
  return (
    <div className="flex items-center">
      {href ? (
        <Link
          href={href}
          aria-label={`Book ${name}, ${price}`}
          className={`${className} ${hasDetails ? "" : "pr-4"} hover:bg-fill active:bg-fill`}
        >
          {body}
        </Link>
      ) : (
        <div className={`${className} pr-4`}>{body}</div>
      )}
      {hasDetails ? (
        <>
          <button
            type="button"
            popoverTarget={sheetId}
            aria-label={`About ${name}`}
            className="pressable mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-primary hover:bg-fill"
          >
            <InfoIcon className="size-5.5" />
          </button>
          <Sheet id={sheetId} title={name}>
            <p className="text-body text-ink-muted">{meta}</p>
            <p className="mt-3 text-display font-bold tabular-nums">{price}</p>
            {deposit ? <p className="mt-1 text-small font-medium text-warning">{deposit}</p> : null}
            {description ? <p className="mt-4 whitespace-pre-line text-body">{description}</p> : null}
            {photos.length > 0 ? (
              <ul className="rail -mx-5 mt-4 flex gap-2 overflow-x-auto px-5" aria-label={`Photos of ${name}`}>
                {photos.map((p, i) => (
                  <li key={p.large} className="w-3/5 shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- large rendition, loaded when the sheet opens */}
                    <img
                      src={p.large}
                      alt={`${name}, photo ${i + 1} of ${photos.length}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-control object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {href ? (
              <Link
                href={href}
                className="pressable mt-6 flex min-h-12 items-center justify-center rounded-full bg-primary font-semibold text-on-primary hover:bg-primary-hover"
              >
                Book {name}
              </Link>
            ) : null}
          </Sheet>
        </>
      ) : null}
    </div>
  );
}
