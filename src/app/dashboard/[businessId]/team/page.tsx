import type { Metadata } from "next";
import Link from "next/link";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listStaff } from "@/server/businesses/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: PageProps<"/dashboard/[businessId]/team">) {
  const { businessId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const staff = await listStaff(db, business.id, { withInvites: true });

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-large-title font-bold tracking-tight">Team</h1>
        <Link href={`/dashboard/${business.id}/team/new`} className="min-h-11 content-center font-medium text-accent">
          Add member
        </Link>
      </div>
      <ul className="divide-y divide-separator overflow-hidden rounded-card bg-surface-elevated shadow-card">
        {staff.map((s) => (
          <li key={s.id}>
            <Link
              href={`/dashboard/${business.id}/team/${s.id}`}
              className="flex min-h-11 items-center gap-3 px-4 py-3 hover:bg-fill"
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill font-semibold text-text-secondary"
              >
                {s.displayName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium">{s.displayName}</span>
                <span className="block truncate text-footnote text-text-secondary">
                  {[
                    s.roleTitle,
                    `${s.serviceIds.length} service${s.serviceIds.length === 1 ? "" : "s"}`,
                    s.userId ? "Has an account" : s.pendingInvite ? "Invite sent" : "No account",
                    s.acceptsOnlineBookings ? null : "Walk-ins only",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span aria-hidden="true" className="text-text-secondary">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-footnote text-text-secondary">
        Team members don&apos;t need an account to appear on your page. Invite them if they should see their own
        bookings.
      </p>
    </>
  );
}
