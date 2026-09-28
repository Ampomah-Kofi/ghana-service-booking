import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/datetime";
import { getPlatformStats, listAudit } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";
import { actionLabel } from "./audit/labels";

export const metadata: Metadata = { title: "Overview · Admin" };

const ADMIN_TZ = "Africa/Accra";

/** How the platform is doing (SPEC §17 platform stats), plus what's waiting for an admin. */
export default async function AdminOverviewPage() {
  const db = await createUserClient();
  const [stats, recent] = await Promise.all([getPlatformStats(db), listAudit(db, {}, 5)]);
  const biz = stats.businesses ?? {};
  const visits = stats.visits_30d ?? {};
  const kept = (visits.completed ?? 0) + (visits.no_show ?? 0);
  const past = Object.values(visits).reduce((s, n) => s + n, 0);
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "–");

  const tiles: [string, string, string?][] = [
    ["People", String(stats.users), `+${stats.users_new_7d} this week`],
    ["Live businesses", String(biz.published ?? 0), `${biz.draft ?? 0} drafts · +${stats.businesses_new_7d} this week`],
    ["Bookings, 7 days", String(stats.bookings_7d), `${stats.bookings_30d} in 30 days`],
    ["Completed", pct(visits.completed ?? 0, past), "of visits in the last 30 days"],
    ["Cancelled", pct(visits.cancelled ?? 0, past), "of visits in the last 30 days"],
    ["No-shows", pct(visits.no_show ?? 0, kept), "of visits that were due"],
  ];
  const todo: [string, number, string][] = [
    ["Verification requests", stats.verification_pending, "/admin/verification"],
    ["Reported reviews", stats.review_reports_open, "/admin/reviews"],
    ["Suspended businesses", biz.suspended ?? 0, "/admin/businesses?status=suspended"],
    ["Suspended people", stats.users_suspended, "/admin/users"],
  ];

  return (
    <>
      <h1 className="mb-4 text-display font-bold">Overview</h1>
      <dl className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-3">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="min-w-0 rounded-card bg-card px-3 py-3 lift">
            <dt className="text-small text-ink-muted">{label}</dt>
            <dd className="text-title font-bold tabular-nums">{value}</dd>
            {hint ? <dd className="truncate text-caption text-ink-muted">{hint}</dd> : null}
          </div>
        ))}
      </dl>

      <h2 className="mb-1.5 px-4 text-small font-medium text-ink-muted">Waiting for you</h2>
      <ul className="mb-8 ios-list overflow-hidden rounded-card bg-card lift">
        {todo.map(([label, n, href]) => (
          <li key={label}>
            <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-fill">
              <span className="flex-1 text-body">{label}</span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-small font-semibold tabular-nums ${n > 0 ? "bg-warning/12 text-warning" : "bg-fill text-ink-muted"}`}
              >
                {n}
              </span>
              <ChevronRightIcon className="shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mb-1.5 px-4 text-small font-medium text-ink-muted">Recent admin actions</h2>
      {recent.length === 0 ? (
        <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">Nothing yet.</p>
      ) : (
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {recent.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <p className="text-body">
                {actionLabel(e.action)} <span className="text-ink-muted">by {e.adminName}</span>
              </p>
              <p className="truncate text-small text-ink-muted">
                {formatDateTime(e.createdAt, ADMIN_TZ)} · {e.reason}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/admin/audit"
        className="mt-2 inline-flex min-h-11 items-center px-4 text-small font-medium text-primary"
      >
        Full audit log
      </Link>
    </>
  );
}
