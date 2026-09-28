/**
 * A small single-series bar chart (bookings per day or week). Plain HTML/CSS, no library:
 * thin bars with rounded tops on a shared baseline and a 2px gap between them, the brand colour
 * for the one series (so no legend), a recessive scale, a native hover tooltip per bar, and the
 * same numbers as a table for screen readers.
 */
export function BarChart({
  title,
  bars,
  unit,
}: {
  title: string;
  bars: { key: string; label: string; short: string; value: number }[];
  /** "booking" → "3 bookings" in tooltips and the table. */
  unit: string;
}) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plural = (v: number) => `${v} ${unit}${v === 1 ? "" : "s"}`;
  // Label a handful of bars so labels never collide: first, last and a few in between.
  const every = Math.max(1, Math.ceil(bars.length / 6));
  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      <div aria-hidden="true" className="relative">
        <span className="absolute top-0 right-0 text-caption text-ink-muted tabular-nums">{max}</span>
        <div className="flex h-32 items-end gap-0.5 border-b border-border pt-5">
          {bars.map((b) => (
            <div
              key={b.key}
              title={`${b.label}: ${plural(b.value)}`}
              className="group flex h-full min-w-0 flex-1 items-end"
            >
              <div
                className="w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                style={{
                  height: b.value > 0 ? `${Math.max(4, (b.value / max) * 100)}%` : "2px",
                  opacity: b.value > 0 ? 1 : 0.25,
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-0.5">
          {bars.map((b, i) => (
            <span
              key={b.key}
              className="min-w-0 flex-1 overflow-visible text-center text-caption whitespace-nowrap text-ink-muted"
            >
              {i % every === 0 || i === bars.length - 1 ? b.short : ""}
            </span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Count</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{plural(b.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
