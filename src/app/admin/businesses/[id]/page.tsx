import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SuspendForm } from "@/components/admin/suspend-form";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { formatDateTime, formatDateWithYear } from "@/lib/datetime";
import { formatPhoneLocal } from "@/lib/phone";
import { requireUser } from "@/server/auth/session";
import { CAN_SUSPEND, getAdminRole, getBusiness, listAudit } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";
import { suspendBusinessAction } from "../../actions";
import { actionLabel } from "../../audit/labels";

export const metadata: Metadata = { title: "Business · Admin" };

const ADMIN_TZ = "Africa/Accra";

/** One business for admins: who runs it, how busy it is, its history, and suspend / restore. */
export default async function AdminBusinessPage({ params }: PageProps<"/admin/businesses/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createUserClient();
  const user = await requireUser();
  const [b, role, history] = await Promise.all([
    getBusiness(db, id),
    getAdminRole(db, user.id),
    listAudit(db, { targetId: id }, 50),
  ]);
  if (!b) notFound();
  const canSuspend = role !== null && CAN_SUSPEND.includes(role);
  const suspended = b.status === "suspended";

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/admin/businesses"
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-primary"
      >
        <ChevronLeftIcon /> Businesses
      </Link>
      <h1 className="text-display font-bold">{b.name}</h1>
      <p className="mb-4 text-body text-ink-muted">
        {b.status} · {b.kind} · verification {b.verification_status}
        {b.status === "published" ? (
          <>
            {" · "}
            <Link href={`/business/${b.slug}`} className="text-primary">
              View page
            </Link>
          </>
        ) : null}
      </p>

      <dl className="mb-6 ios-list overflow-hidden rounded-card bg-card lift">
        <Row label="Owner">
          {b.owners.map((o) => (
            <Link key={o.id} href={`/admin/users/${o.id}`} className="block text-primary">
              {o.name}
              {o.phone ? ` · ${formatPhoneLocal(o.phone)}` : ""}
              {o.suspended ? " (suspended)" : ""}
            </Link>
          ))}
        </Row>
        <Row label="Contact">
          {[b.phone && formatPhoneLocal(b.phone), b.whatsapp && `WhatsApp ${formatPhoneLocal(b.whatsapp)}`, b.email]
            .filter(Boolean)
            .join(" · ") || "None"}
        </Row>
        <Row label="Joined">{formatDateWithYear(b.created_at, ADMIN_TZ)}</Row>
        <Row label="Activity">
          {b.bookings_30d} bookings in 30 days · {b.bookings_total} in all
        </Row>
        <Row label="Catalogue">
          {b.services} services · {b.team_size} {b.team_size === 1 ? "person" : "people"}
        </Row>
        <Row label="Reviews">
          {b.rating_count > 0 ? `${b.rating_avg?.toFixed(1)} ★ from ${b.rating_count}` : "None yet"}
          {b.open_reports > 0 ? ` · ${b.open_reports} reported` : ""}
        </Row>
      </dl>

      {canSuspend ? (
        <section aria-labelledby="suspend-heading" className="mb-6 rounded-card bg-card p-4 lift">
          <h2 id="suspend-heading" className="mb-2 text-heading font-semibold">
            {suspended ? "Restore" : "Suspend"}
          </h2>
          <SuspendForm id={b.id} suspended={suspended} action={suspendBusinessAction} what="business" />
        </section>
      ) : (
        <p className="mb-6 text-small text-ink-muted">Support admins can look but not suspend.</p>
      )}

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
