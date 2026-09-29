import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SuspendForm } from "@/components/admin/suspend-form";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { formatDateTime, formatDateWithYear } from "@/lib/datetime";
import { formatPhoneLocal } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import { CAN_SUSPEND, getAdminRole, getUser, listAudit } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";
import { suspendUserAction } from "../../actions";
import { actionLabel } from "../../audit/labels";

export const metadata: Metadata = { title: "Person · Admin" };

const ADMIN_TZ = "Africa/Accra";

/** One person for admins: contact, businesses, booking record, history, suspend / restore. */
export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createUserClient();
  const me = await requireUser();
  const [u, role, history] = await Promise.all([
    getUser(db, id),
    getAdminRole(db, me.id),
    listAudit(db, { targetId: id }, 50),
  ]);
  if (!u) notFound();
  const canSuspend = role !== null && CAN_SUSPEND.includes(role) && !u.admin_role && u.id !== me.id;
  const suspended = u.suspended_at !== null;

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/admin/users"
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-primary"
      >
        <ChevronLeftIcon /> People
      </Link>
      <h1 className="text-display font-bold">{u.full_name || "No name"}</h1>
      <p className="mb-4 text-body text-ink-muted">
        {suspended ? `Suspended ${formatDateWithYear(u.suspended_at!, ADMIN_TZ)}` : "Active"}
        {u.admin_role ? ` · ${u.admin_role.replace("_", " ")}` : ""}
      </p>
      {suspended && u.suspension_reason ? (
        <p className="mb-4 rounded-control bg-danger/10 px-3 py-2 text-small text-danger">{u.suspension_reason}</p>
      ) : null}

      <dl className="mb-6 ios-list overflow-hidden rounded-card bg-card lift">
        <Row label="Phone">{u.phone ? formatPhoneLocal(u.phone) : "None"}</Row>
        <Row label="Email">{u.email ?? "None"}</Row>
        <Row label="Joined">{formatDateWithYear(u.created_at, ADMIN_TZ)}</Row>
        <Row label="Bookings">
          {u.bookings} · {u.cancelled} cancelled · {u.no_shows} no-shows
        </Row>
        <Row label="Reviews">
          {u.reviews} written · {u.reports_made} reports made
        </Row>
        <Row label="Businesses">
          {u.businesses.length === 0
            ? "None"
            : u.businesses.map((b) => (
                <Link key={b.id} href={`/admin/businesses/${b.id}`} className="block text-primary">
                  {b.name}{" "}
                  <span className="text-ink-muted">
                    ({b.role}, {b.status})
                  </span>
                </Link>
              ))}
        </Row>
      </dl>

      {canSuspend ? (
        <section aria-labelledby="suspend-heading" className="mb-6 rounded-card bg-card p-4 lift">
          <h2 id="suspend-heading" className="mb-2 text-heading font-semibold">
            {suspended ? "Restore" : "Suspend"}
          </h2>
          <SuspendForm id={u.id} suspended={suspended} action={suspendUserAction} what="account" />
        </section>
      ) : null}

      <h2 className="mb-2 text-heading font-semibold">Admin history</h2>
      {history.length === 0 ? (
        <p className="text-body text-ink-muted">No admin actions yet.</p>
      ) : (
        <ol className="ios-list overflow-hidden rounded-card bg-card lift">
          {history.map((e) => (
            <li key={e.id} className="px-4 py-3">
              <p className="text-body">
                {actionLabel(e.action)} <span className="text-ink-muted">by {e.adminName}</span>
              </p>
              <p className="text-small text-ink-muted">
                {formatDateTime(e.createdAt, ADMIN_TZ)} · {e.reason}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-body">
      <dt className="w-20 shrink-0 text-small leading-6 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}
