import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatPhoneLocal } from "@/lib/phone";
import { listUsers } from "@/server/admin/admin";
import { createUserClient } from "@/server/db/supabase-server";

export const metadata: Metadata = { title: "People · Admin" };

/** Find anyone by name, phone (as typed) or email. */
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const rows = await listUsers(await createUserClient(), q || null);
  return (
    <>
      <h1 className="mb-4 text-display font-bold">People</h1>
      <form role="search" className="mb-4 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search people
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name, phone or email"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-card px-3 text-body outline-none focus:border-primary"
        />
        <button type="submit" className="min-h-11 rounded-full bg-primary px-4 text-body font-semibold text-on-primary">
          Search
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">Nobody matches.</p>
      ) : (
        <ul className="ios-list overflow-hidden rounded-card bg-card lift">
          {rows.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/users/${u.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{u.fullName || "No name"}</span>
                  <span className="block truncate text-small text-ink-muted">
                    {[u.phone ? formatPhoneLocal(u.phone) : null, u.email].filter(Boolean).join(" · ") || "No contact"}
                  </span>
                  <span className="block text-small text-ink-muted tabular-nums">
                    {u.bookings} bookings{u.businessesOwned > 0 ? ` · owns ${u.businessesOwned}` : ""}
                  </span>
                </span>
                {u.suspendedAt ? (
                  <span className="shrink-0 rounded-chip bg-danger/10 px-2 py-0.5 text-caption text-danger">
                    suspended
                  </span>
                ) : u.adminRole ? (
                  <span className="shrink-0 rounded-chip bg-primary-soft px-2 py-0.5 text-caption text-primary">
                    {u.adminRole.replace("_", " ")}
                  </span>
                ) : null}
                <ChevronRightIcon className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
