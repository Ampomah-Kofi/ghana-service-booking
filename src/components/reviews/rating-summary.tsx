import type { RatingSummary as Summary } from "@/server/reviews/reviews";
import { Stars } from "./stars";

/** Big average, stars, count, and a bar per star (5 → 1), like app-store ratings. */
export function RatingSummary({ summary }: { summary: Summary }) {
  const max = Math.max(1, ...summary.distribution);
  return (
    <div className="flex items-center gap-5">
      <div className="shrink-0 text-center">
        <p className="text-display leading-none font-bold tabular-nums">{summary.average?.toFixed(1) ?? "–"}</p>
        <p className="mt-1 text-caption text-ink-muted">out of 5</p>
      </div>
      <div className="min-w-0 flex-1">
        <ul aria-label="Ratings by stars" className="grid gap-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = summary.distribution[star - 1];
            return (
              <li key={star} className="flex items-center gap-2 text-caption text-ink-muted">
                <span className="w-3 text-right tabular-nums">{star}</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-fill" aria-hidden="true">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-ink/60"
                    style={{ width: `${(n / max) * 100}%` }}
                  />
                </span>
                <span className="sr-only">
                  {star} stars: {n}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-right text-caption text-ink-muted">
          {summary.count === 1 ? "1 review" : `${summary.count} reviews`}
        </p>
      </div>
    </div>
  );
}

/** Small inline rating: "★ 4.8 (12)" or nothing. */
export function RatingInline({ average, count }: { average: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
      <Stars value={Math.round(average)} className="size-3.5" />
      {average.toFixed(1)} <span className="font-normal text-ink-muted">({count})</span>
    </span>
  );
}
