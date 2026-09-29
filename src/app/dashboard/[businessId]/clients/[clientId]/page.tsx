import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentListRow } from "@/components/calendar/appointment-list-row";
import { ChatIcon, ChevronLeftIcon, PhoneIcon } from "@/components/ui/icons";
import { formatDateShort } from "@/lib/datetime";
import { formatMoney } from "@/lib/money";
import { formatPhoneInternational } from "@/lib/phone";
import { telUrl, whatsappChatUrl } from "@/lib/share";
import { managedBusinessOr404 } from "@/server/businesses/access";
import { listClientAppointments } from "@/server/bookings/appointments";
import { getClient } from "@/server/clients/clients";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: PageProps<"/dashboard/[businessId]/clients/[clientId]">) {
  const { businessId, clientId } = await params;
  const { db, business } = await managedBusinessOr404(businessId);
  const client = await getClient(db, business.id, clientId);
  if (!client) notFound();
  const appointments = await listClientAppointments(db, business.id, client.id);
  const base = `/dashboard/${business.id}`;
  const money = formatMoney({ amountMinor: client.spentMinor, currency: business.currency.code }, business.currency);

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`${base}/clients`}
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-0.5 text-small font-medium text-primary"
      >
        <ChevronLeftIcon /> Clients
      </Link>
      <h1 className="text-display font-bold">{client.name}</h1>
      <p className="mb-4 text-body text-ink-muted">
        {client.phone ? formatPhoneInternational(client.phone) : "No phone number"}
        {client.hasAccount ? " · Has an account" : ""}
      </p>

      {client.phone ? (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <a
            href={telUrl(client.phone)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-fill font-semibold hover:bg-ink/10"
          >
            <PhoneIcon /> Call
          </a>
          <a
            href={whatsappChatUrl(client.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-fill font-semibold text-whatsapp hover:bg-ink/10"
          >
            <ChatIcon /> WhatsApp
          </a>
        </div>
      ) : null}

      <dl className="mb-6 grid grid-cols-3 gap-2">
        {[
          ["Visits", String(client.visits)],
          ["Spent", money],
          ["No-shows", String(client.noShows)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-card bg-card p-3 lift">
            <dt className="text-caption text-ink-muted">{label}</dt>
            <dd className="truncate text-heading font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="history" className="mb-6">
        <h2 id="history" className="mb-2 text-title font-semibold">
          Appointments
        </h2>
        {appointments.length === 0 ? (
          <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">No appointments yet.</p>
        ) : (
          <ul className="ios-list overflow-hidden rounded-card bg-card lift">
            {appointments.map((a) => (
              <AppointmentListRow
                key={a.id}
                appointment={a}
                href={`${base}/appointments/${a.id}`}
                timezone={business.timezone}
                showStaff={business.kind === "team"}
                dateLabel={formatDateShort(a.startsAt, business.timezone)}
                hideCustomer
              />
            ))}
          </ul>
        )}
      </section>

      <h2 className="mb-2 text-heading font-semibold">Details</h2>
      <ClientForm
        businessId={business.id}
        client={{ id: client.id, name: client.name, phone: client.phone ?? "", notes: client.notes ?? "" }}
      />
    </div>
  );
}
