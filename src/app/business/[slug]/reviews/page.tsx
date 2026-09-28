import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RatingSummary } from "@/components/reviews/rating-summary";
import { ReviewCard } from "@/components/reviews/review-card";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { getCurrentUser } from "@/server/auth/session";
import { getBusinessBySlug } from "@/server/businesses/queries";
import { createUserClient } from "@/server/db/supabase-server";
import { listBusinessReviews, ratingSummary } from "@/server/reviews/reviews";

const PAGE = 20;

export async function generateMetadata({ params }: PageProps<"/business/[slug]/reviews">): Promise<Metadata> {
  const { slug } = await params;
  const business = await getBusinessBySlug(await createUserClient(), slug);
  return { title: business ? `Reviews of ${business.name}` : "Not found" };
}

/** All published reviews for a business, 20 per page. */
export default async function BusinessReviewsPage({ params, searchParams }: PageProps<"/business/[slug]/reviews">) {
  const { slug } = await params;
  const sp = await searchParams;
  const page = Math.min(50, Math.max(1, Number.parseInt(typeof sp.page === "string" ? sp.page : "1", 10) || 1));
  const db = await createUserClient();
  const business = await getBusinessBySlug(db, slug);
  if (!business || business.status !== "published") notFound();
  const user = await getCurrentUser();
  const [summary, reviews] = await Promise.all([
    ratingSummary(db, business.id),
    listBusinessReviews(db, business.id, { limit: PAGE, offset: (page - 1) * PAGE, viewerId: user?.id ?? null }),
  ]);
  const more = summary.count > page * PAGE;

  return (
    <>
      <Link
        href={`/business/${business.slug}`}
        className="mt-3 mb-4 inline-flex min-h-11 items-center gap-1 font-medium text-primary"
      >
        <ChevronLeftIcon /> {business.name}
      </Link>
      <h1 className="mb-4 text-display font-bold">Reviews</h1>
      {summary.count > 0 ? (
        <div className="mb-5 rounded-card bg-card p-4 lift">
          <RatingSummary summary={summary} />
        </div>
      ) : null}
      {reviews.length === 0 ? (
        <p className="text-body text-ink-muted">No reviews yet.</p>
      ) : (
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} businessName={business.name} canReport={Boolean(user) && !r.mine} />
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Pages" className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={`?page=${page - 1}`} className="inline-flex min-h-11 items-center font-medium text-primary">
            Newer
          </Link>
        ) : (
          <span />
        )}
        {more ? (
          <Link href={`?page=${page + 1}`} className="inline-flex min-h-11 items-center font-medium text-primary">
            Older
          </Link>
        ) : null}
      </nav>
    </>
  );
}
