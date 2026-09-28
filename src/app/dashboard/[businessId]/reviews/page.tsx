import type { Metadata } from "next";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewCard } from "@/components/reviews/review-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StarIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import { Segmented } from "@/components/ui/segmented";
import { memberBusinessOr404 } from "@/server/businesses/access";
import { listReviewsForBusiness, ratingSummary } from "@/server/reviews/reviews";
import { ReplyForm } from "./reply-form";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Reviews" };

/** What customers say: rating summary, every review (hidden ones marked), and one public reply each. */
export default async function ProviderReviewsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/reviews">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const filter = sp.show === "unanswered" ? "unanswered" : "all";
  const { db, business, canManage } = await memberBusinessOr404(businessId);
  const [summary, reviews] = await Promise.all([
    ratingSummary(db, business.id),
    listReviewsForBusiness(db, business.id, { filter }),
  ]);

  return (
    <>
      <LargeTitle title="Reviews" className="mb-4" />
      {summary.count > 0 ? (
        <div className="mb-4 rounded-card bg-card p-4 lift">
          <RatingSummary summary={summary} />
        </div>
      ) : null}
      <div className="mb-4">
        <Segmented
          label="Show"
          items={[
            { href: "?", label: "All", active: filter === "all" },
            { href: "?show=unanswered", label: "Needs a reply", active: filter === "unanswered" },
          ]}
        />
      </div>
      {reviews.length === 0 ? (
        <EmptyState
          icon={StarIcon}
          title={filter === "unanswered" ? "All caught up" : "No reviews yet"}
          body={
            filter === "unanswered"
              ? "You've replied to every review."
              : "When customers finish a visit they can rate it. Their reviews appear here."
          }
          className="py-8"
        />
      ) : (
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard
                review={r}
                businessName={business.name}
                canReport={false}
                footer={
                  <span className="flex items-center gap-2">
                    {r.status === "hidden" ? (
                      <span className="rounded-full bg-warning/10 px-2.5 py-1 text-caption font-semibold text-warning">
                        Hidden by {BRAND.name} after a report
                      </span>
                    ) : canManage ? (
                      <ReplyForm reviewId={r.id} authorName={r.authorName} current={r.reply?.body ?? null} />
                    ) : null}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
