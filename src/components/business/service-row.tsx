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
}: {
  id: string;
  href: string | null;
  name: string;
  meta: string;
  description?: string | null;
  price: string;
  deposit?: string | null;
}) {
  const hasDetails = Boolean(description || deposit);
  const sheetId = `service-${id}`;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">{name}</span>
        <span className="block text-small text-ink-muted">{meta}</span>
        {description ? (
          <span className="mt-0.5 line-clamp-1 block text-small text-ink-muted">{description}</span>
        ) : null}
        {deposit ? <span className="mt-0.5 block text-small text-warning">{deposit}</span> : null}
      </span>
      <span className="shrink-0 text-heading font-semibold tabular-nums">{price}</span>
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
