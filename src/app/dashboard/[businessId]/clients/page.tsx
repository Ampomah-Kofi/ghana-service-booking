import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { formatDateShort } from "@/lib/datetime";
import { formatPhoneInternational } from "@/lib/phone";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listClients } from "@/server/clients/clients";
import { ClientForm } from "./client-form";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ params, searchParams }: PageProps<"/dashboard/[businessId]/clients">) {
  const { businessId } = await params;
  const sp = await searchParams;
  const { db, business } = await managedBusinessOr404(businessId);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const clients = await listClients(db, business.id, { search: q });
  const base = `/dashboard/${business.id}`;

  return (
    <>
      <h1 className="mb-4 text-display font-bold tracking-tight">Clients</h1>
      <form role="search" className="mb-4">
        <label htmlFor="q" className="sr-only">
          Search clients
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by name or phone"
          className="block min-h-12 w-full rounded-control border border-border bg-card px-4 text-body outline-none focus:border-primary"
        />
      </form>

      {clients.length === 0 ? (
        <p className="mb-6 rounded-card border border-border bg-card p-5 text-body text-ink-muted">
          {q
            ? `No clients match "${q}".`
            : "No clients yet. They're added automatically when someone books, or you can add one below."}
        </p>
      ) : (
        <ul className="mb-6 divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`${base}/clients/${c.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-fill"
              >
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-small font-semibold text-primary"
                >
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-medium">{c.name}</span>
                  <span className="block truncate text-small text-ink-muted">
                    {[
                      c.phone ? formatPhoneInternational(c.phone) : null,
                      `${c.visits} visit${c.visits === 1 ? "" : "s"}`,
                      c.lastVisitAt ? `last ${formatDateShort(c.lastVisitAt, business.timezone)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {c.noShows > 0 ? (
                  <span className="shrink-0 rounded-chip bg-danger/10 px-2 py-0.5 text-caption text-danger">
                    {c.noShows} no-show{c.noShows === 1 ? "" : "s"}
                  </span>
                ) : null}
                <ChevronRightIcon className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-heading font-semibold">Add a client</h2>
      <ClientForm businessId={business.id} client={null} />
    </>
  );
}
