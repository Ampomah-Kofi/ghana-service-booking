import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatPhoneLocal } from "@/lib/phone";
import { listBusinesses, type BusinessStatus } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";

export const metadata: Metadata = { title: "Businesses · Admin" };

const STATUSES: [BusinessStatus | "", string][] = [
  ["", "All"],
  ["published", "Live"],
  ["draft", "Drafts"],
  ["suspended", "Suspended"],
];
const TONE: Record<BusinessStatus, string> = {
  published: "bg-success/10 text-success",
  draft: "bg-fill text-ink-muted",
  suspended: "bg-danger/10 text-danger",
  deactivated: "bg-fill text-ink-muted",
};

/** Find any business by name, link or town (SPEC §17). */
export default async function AdminBusinessesPage({ searchParams }: PageProps<"/admin/businesses">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const status = STATUSES.some(([s]) => s && s === sp.status) ? (sp.status as BusinessStatus) : null;
  const rows = await listBusinesses(await createUserClient(), q || null, status);
  const href = (s: string) =>
    `/admin/businesses?${new URLSearchParams({ ...(q ? { q } : {}), ...(s ? { status: s } : {}) })}`;

  return (
    <>
      <h1 className="mb-4 text-display font-bold">Businesses</h1>
      <form role="search" className="mb-3 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search businesses
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name, link or town"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-card px-3 text-body outline-none focus:border-primary"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <button type="submit" className="min-h-11 rounded-full bg-primary px-4 text-body font-semibold text-on-primary">
          Search
        </button>
      </form>
      <nav aria-label="Status" className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map(([s, label]) => (
          <Link
            key={label}
            href={href(s)}
            aria-current={(status ?? "") === s ? "page" : undefined}
            className="min-h-9 content-center rounded-full bg-fill px-3 text-small font-medium aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
          >
            {label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">No businesses match.</p>
      ) : (
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/businesses/${b.id}`}
                className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{b.name}</span>
                  <span className="block truncate text-small text-ink-muted">
                    {[b.place, b.ownerName, b.ownerPhone ? formatPhoneLocal(b.ownerPhone) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="block text-small text-ink-muted tabular-nums">
                    {b.bookings30d} bookings in 30 days
                  </span>
                </span>
                <span className={`shrink-0 rounded-chip px-2 py-0.5 text-caption ${TONE[b.status]}`}>{b.status}</span>
                <ChevronRightIcon className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
