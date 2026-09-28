import type { Metadata } from "next";
import { ReviewCard } from "@/components/reviews/review-card";
import { REPORT_REASONS, type ReportReason } from "@/schemas/reviews";
import { createUserClient } from "@/server/db/supabase-server";
import { listReportedReviews } from "@/server/reviews/reviews";
import { ModerateForm } from "./moderate-form";

export const metadata: Metadata = { title: "Reported reviews · Admin" };

/** Moderation queue (Phase 7 minimum; full tools in Phase 10). Every decision is audit-logged. */
export default async function AdminReviewsPage() {
  const reported = await listReportedReviews(await createUserClient());
  return (
    <>
      <h1 className="mb-2 text-display font-bold">Reported reviews</h1>
      <p className="mb-6 text-body text-ink-muted">
        Keep a review that follows the rules, hide one while you check, or remove it. Hidden and removed reviews leave
        the rating. Every decision is recorded in the audit log.
      </p>
      {reported.length === 0 ? (
        <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">Nothing reported. All clear.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {reported.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-card bg-card lift">
              <p className="px-4 pt-3 text-small font-semibold">{r.businessName}</p>
              <ReviewCard review={r} businessName={r.businessName} canReport={false} />
              <div className="border-t border-border px-4 py-3">
                <p className="mb-2 text-small font-semibold">
                  {r.reports.length === 1 ? "1 report" : `${r.reports.length} reports`}
                </p>
                <ul className="mb-3 grid gap-1 text-small text-ink-muted">
                  {r.reports.map((rep, i) => (
                    <li key={i}>
                      {REPORT_REASONS[rep.reason as ReportReason] ?? rep.reason}
                      {rep.details ? `: “${rep.details}”` : ""}
                    </li>
                  ))}
                </ul>
                <ModerateForm reviewId={r.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
