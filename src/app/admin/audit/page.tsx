import type { Metadata } from "next";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { listAudit } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";
import { actionLabel, targetHref } from "./labels";

export const metadata: Metadata = { title: "Audit log · Admin" };

const ADMIN_TZ = "Africa/Accra";
const FILTERS: [string, string][] = [
  ["", "All"],
  ["business", "Businesses"],
  ["user", "People"],
  ["review", "Reviews"],
  ["category", "Categories"],
];

/** Every admin change: who, what, why, before and after (SPEC §17: all admin actions are audit-logged). */
export default async function AdminAuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  const action = FILTERS.some(([f]) => f && f === sp.action) ? String(sp.action) : "";
  const entries = await listAudit(await createUserClient(), action ? { action: `${action}.` } : {}, 200);
  return (
    <>
      <h1 className="mb-4 text-display font-bold">Audit log</h1>
      <nav aria-label="Filter" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([f, label]) => (
          <Link
            key={label}
            href={f ? `/admin/audit?action=${f}` : "/admin/audit"}
            aria-current={action === f ? "page" : undefined}
            className="min-h-9 content-center rounded-full bg-fill px-3 text-small font-medium aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
          >
            {label}
          </Link>
        ))}
      </nav>
      {entries.length === 0 ? (
        <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">Nothing logged yet.</p>
      ) : (
        <ol className="ios-list overflow-hidden rounded-card bg-card lift">
          {entries.map((e) => {
            const href = targetHref(e.targetTable, e.targetId);
            return (
              <li key={e.id} className="px-4 py-3">
                <p className="text-body">
                  {href ? (
                    <Link href={href} className="text-primary">
                      {actionLabel(e.action)}
                    </Link>
                  ) : (
                    actionLabel(e.action)
                  )}{" "}
                  <span className="text-ink-muted">by {e.adminName}</span>
                </p>
                <p className="text-small text-ink-muted">{formatDateTime(e.createdAt, ADMIN_TZ)}</p>
                <p className="text-small">{e.reason}</p>
                <details className="mt-1">
                  <summary className="min-h-9 cursor-pointer content-center text-small text-primary">
                    Before and after
                  </summary>
                  <pre className="overflow-x-auto rounded-control bg-fill p-2 text-caption">
                    {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                  </pre>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
