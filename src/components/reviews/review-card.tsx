import type { ReactNode } from "react";
import { formatMonthYear } from "@/lib/datetime";
import type { ReviewView } from "@/server/reviews/reviews";
import { ReportReview } from "./report-review";
import { Stars } from "./stars";

/** One review: who, stars, when and what they had, their words, and the business's reply. */
export function ReviewCard({
  review,
  businessName,
  canReport,
  footer,
}: {
  review: ReviewView;
  businessName: string;
  canReport: boolean;
  footer?: ReactNode;
}) {
  return (
    <article className="px-4 py-4">
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-small font-bold text-primary"
        >
          {review.authorName.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">{review.authorName}</p>
          <p className="truncate text-caption text-ink-muted">
            {review.serviceName}
            {review.staffName ? ` with ${review.staffName}` : ""} · {formatMonthYear(review.visitedOn)}
          </p>
        </div>
        <Stars value={review.rating} className="size-3.5" />
      </header>
      {review.body ? <p className="mt-2.5 text-body whitespace-pre-line">{review.body}</p> : null}
      {review.reply ? (
        <div className="mt-3 rounded-control bg-fill px-3.5 py-2.5">
          <p className="text-small font-semibold">Reply from {businessName}</p>
          <p className="mt-0.5 text-small whitespace-pre-line">{review.reply.body}</p>
        </div>
      ) : null}
      {canReport || footer ? (
        <div className="mt-1.5 flex items-center justify-between gap-3">
          {footer ?? <span />}
          {canReport ? <ReportReview reviewId={review.id} /> : null}
        </div>
      ) : null}
    </article>
  );
}
