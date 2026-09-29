/**
 * A price at the end of a service row, from `formatPrice`. The amount carries the weight; "from" sits
 * small above it, and "Price on request" is quiet wrapped text, so service names keep their room on a phone.
 */
export function PriceTag({ price }: { price: string }) {
  if (!/\d/.test(price)) {
    return (
      <span className="max-w-[7.5rem] shrink-0 text-right text-small leading-tight font-medium text-ink-muted">
        {price}
      </span>
    );
  }
  const from = price.startsWith("From ");
  return (
    <span className="flex shrink-0 flex-col items-end text-right">
      {from ? <span className="text-caption leading-none text-ink-muted">from</span> : null}
      <span className="text-body font-semibold tabular-nums">{from ? price.slice(5) : price}</span>
    </span>
  );
}
