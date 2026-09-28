import "server-only";
import type { Db } from "@/server/db/client";
import { nullableArg } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";
import type { Database } from "@/server/db/types";
import type { ReportReason, ReviewInput } from "@/schemas/reviews";

export type ReviewStatus = Database["public"]["Enums"]["review_status"];

export type ReviewView = {
  id: string;
  businessId: string;
  appointmentId: string;
  authorName: string;
  mine: boolean;
  serviceName: string;
  staffName: string | null;
  visitedOn: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  reply: { body: string; at: string } | null;
  createdAt: string;
  /** The author may still edit (published, within 14 days). */
  editableUntil: string | null;
};

export type RatingSummary = {
  average: number | null;
  count: number;
  /** Published reviews per star, index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
};

const EDIT_DAYS = 14;
const select =
  "id, business_id, appointment_id, user_id, author_name, service_name, staff_name, visited_on, rating, body, status, reply_body, replied_at, created_at" as const;

type Row = {
  id: string;
  business_id: string;
  appointment_id: string;
  user_id: string | null;
  author_name: string;
  service_name: string;
  staff_name: string | null;
  visited_on: string;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  reply_body: string | null;
  replied_at: string | null;
  created_at: string;
};

function toView(r: Row, viewerId: string | null, now = new Date()): ReviewView {
  const until = new Date(new Date(r.created_at).getTime() + EDIT_DAYS * 86_400_000);
  const mine = viewerId !== null && r.user_id === viewerId;
  return {
    id: r.id,
    businessId: r.business_id,
    appointmentId: r.appointment_id,
    authorName: r.author_name,
    mine,
    serviceName: r.service_name,
    staffName: r.staff_name,
    visitedOn: r.visited_on,
    rating: r.rating,
    body: r.body,
    status: r.status,
    reply: r.reply_body && r.replied_at ? { body: r.reply_body, at: r.replied_at } : null,
    createdAt: r.created_at,
    editableUntil: mine && r.status === "published" && until > now ? until.toISOString() : null,
  };
}

/** Public list for a business page (published only, newest first). */
export async function listBusinessReviews(
  db: Db,
  businessId: string,
  { limit = 10, offset = 0, viewerId = null }: { limit?: number; offset?: number; viewerId?: string | null } = {},
): Promise<ReviewView[]> {
  const { data, error } = await db
    .from("reviews")
    .select(select)
    .eq("business_id", businessId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(offset, offset + Math.min(limit, 50) - 1);
  if (error) throw toAppError(error);
  return data.map((r) => toView(r, viewerId));
}

/** Everything for the business's own reviews screen (members only by RLS), including hidden ones. */
export async function listReviewsForBusiness(
  db: Db,
  businessId: string,
  { filter = "all", limit = 50 }: { filter?: "all" | "unanswered"; limit?: number } = {},
): Promise<ReviewView[]> {
  let q = db
    .from("reviews")
    .select(select)
    .eq("business_id", businessId)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filter === "unanswered") q = q.is("reply_body", null).eq("status", "published");
  const { data, error } = await q;
  if (error) throw toAppError(error);
  return data.map((r) => toView(r, null));
}

export async function ratingSummary(db: Db, businessId: string): Promise<RatingSummary> {
  const { data, error } = await db
    .from("reviews")
    .select("rating")
    .eq("business_id", businessId)
    .eq("status", "published")
    .limit(5000);
  if (error) throw toAppError(error);
  const distribution: RatingSummary["distribution"] = [0, 0, 0, 0, 0];
  for (const r of data) distribution[r.rating - 1] += 1;
  const count = data.length;
  const average = count === 0 ? null : Math.round((data.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
  return { average, count, distribution };
}

/** The signed-in user's review of one appointment, if any. */
export async function myReviewFor(db: Db, userId: string, appointmentId: string): Promise<ReviewView | null> {
  const { data, error } = await db
    .from("reviews")
    .select(select)
    .eq("appointment_id", appointmentId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw toAppError(error);
  return data ? toView(data, userId) : null;
}

export async function listMyReviews(
  db: Db,
  userId: string,
): Promise<(ReviewView & { businessName: string; businessSlug: string })[]> {
  const { data, error } = await db
    .from("reviews")
    .select(`${select}, businesses ( name, slug )`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw toAppError(error);
  return data.map((r) => ({
    ...toView(r, userId),
    businessName: r.businesses?.name ?? "",
    businessSlug: r.businesses?.slug ?? "",
  }));
}

/** Appointment ids (of these) that the user has already reviewed. */
export async function reviewedAppointmentIds(db: Db, userId: string, appointmentIds: string[]): Promise<Set<string>> {
  if (appointmentIds.length === 0) return new Set();
  const { data, error } = await db
    .from("reviews")
    .select("appointment_id")
    .eq("user_id", userId)
    .in("appointment_id", appointmentIds.slice(0, 200));
  if (error) throw toAppError(error);
  return new Set(data.map((r) => r.appointment_id));
}

export async function submitReview(db: Db, appointmentId: string, input: ReviewInput): Promise<string> {
  const { data, error } = await db.rpc("submit_review", {
    p_appointment_id: appointmentId,
    p_rating: input.rating,
    p_body: nullableArg(input.body),
  });
  if (error) throw toAppError(error);
  return data;
}

export async function updateReview(db: Db, reviewId: string, input: ReviewInput): Promise<void> {
  const { error } = await db.rpc("update_review", {
    p_review_id: reviewId,
    p_rating: input.rating,
    p_body: nullableArg(input.body),
  });
  if (error) throw toAppError(error);
}

export async function replyToReview(db: Db, reviewId: string, body: string): Promise<void> {
  const { error } = await db.rpc("reply_to_review", { p_review_id: reviewId, p_body: body });
  if (error) throw toAppError(error);
}

export async function reportReview(
  db: Db,
  reviewId: string,
  reason: ReportReason,
  details: string | null,
): Promise<void> {
  const { error } = await db.rpc("report_review", {
    p_review_id: reviewId,
    p_reason: reason,
    p_details: nullableArg(details),
  });
  if (error) throw toAppError(error);
}

export type ReportedReview = ReviewView & {
  businessName: string;
  reports: { reason: string; details: string | null; createdAt: string }[];
};

/** Platform admins: reviews with open reports, most reported first. */
export async function listReportedReviews(db: Db): Promise<ReportedReview[]> {
  const { data, error } = await db
    .from("review_reports")
    .select(`reason, details, created_at, reviews ( ${select}, businesses ( name ) )`)
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw toAppError(error);
  const byReview = new Map<string, ReportedReview>();
  for (const r of data) {
    const review = r.reviews;
    if (!review) continue;
    const entry =
      byReview.get(review.id) ??
      ({ ...toView(review, null), businessName: review.businesses?.name ?? "", reports: [] } satisfies ReportedReview);
    entry.reports.push({ reason: r.reason, details: r.details, createdAt: r.created_at });
    byReview.set(review.id, entry);
  }
  return [...byReview.values()].sort((a, b) => b.reports.length - a.reports.length);
}

export async function moderateReview(db: Db, reviewId: string, status: ReviewStatus, reason: string): Promise<void> {
  const { error } = await db.rpc("admin_moderate_review", {
    p_review_id: reviewId,
    p_status: status,
    p_reason: reason,
  });
  if (error) throw toAppError(error);
}

/** One review the caller can see (RLS), or null. */
export async function getReview(db: Db, reviewId: string, viewerId: string | null): Promise<ReviewView | null> {
  const { data, error } = await db.from("reviews").select(select).eq("id", reviewId).maybeSingle();
  if (error) throw toAppError(error);
  return data ? toView(data, viewerId) : null;
}
