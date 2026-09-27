import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";

/** A service in a price list. The whole row is the tap target when it can be booked. */
export function ServiceRow({
  href,
  name,
  meta,
  description,
  price,
  deposit,
}: {
  href: string | null;
  name: string;
  meta: string;
  description?: string | null;
  price: string;
  deposit?: string | null;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-medium">{name}</span>
        <span className="block text-small text-ink-muted">{meta}</span>
        {description ? <span className="mt-1 block text-small text-ink-muted">{description}</span> : null}
        {deposit ? <span className="mt-1 block text-small text-warning">{deposit}</span> : null}
      </span>
      <span className="shrink-0 text-heading font-semibold tabular-nums">{price}</span>
      {href ? <ChevronRightIcon className="shrink-0 text-ink-muted" /> : null}
    </>
  );
  const className = "flex min-h-14 items-center gap-3 px-4 py-3";
  return href ? (
    <Link href={href} aria-label={`Book ${name}, ${price}`} className={`${className} hover:bg-fill active:bg-fill`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
