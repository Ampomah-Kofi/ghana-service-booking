import type { Metadata } from "next";
import Link from "next/link";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { formatDateShort, formatDateWithYear } from "@/lib/datetime";
import { formatPhoneInternational } from "@/lib/phone";
import { listVerificationQueue, type VerificationQueueItem } from "@/server/businesses/verification";
import { createUserClient } from "@/server/db/supabase-server";
import { DecideForm } from "./decide-form";

export const metadata: Metadata = { title: "Verification · Admin" };

const ADMIN_TZ = "Africa/Accra";

/** Verification queue (ADR-0015): check the owner's details, then verify or decline. Every decision is audit-logged. */
export default async function AdminVerificationPage() {
  const { pending, verified } = await listVerificationQueue(await createUserClient());
  return (
    <>
      <h1 className="mb-2 text-display font-bold">Verification</h1>
      <p className="mb-6 text-body text-ink-muted">
        Call the business phone and check the owner&apos;s details (for example their Ghana Card or business
        registration) before you verify. Say what you checked: it goes in the audit log.
      </p>

      <h2 className="mb-2 text-heading font-semibold">Waiting ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="mb-8 rounded-card bg-card p-4 text-body text-ink-muted lift">No requests. All clear.</p>
      ) : (
        <ul className="mb-8 grid grid-cols-[minmax(0,1fr)] gap-4">
          {pending.map((b) => (
            <Item key={b.id} b={b} />
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-heading font-semibold">Verified ({verified.length})</h2>
      {verified.length === 0 ? (
        <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">None yet.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {verified.map((b) => (
            <Item key={b.id} b={b} />
          ))}
        </ul>
      )}
    </>
  );
}

function Item({ b }: { b: VerificationQueueItem }) {
  const isVerified = b.status === "verified";
  return (
    <li className="overflow-hidden rounded-card bg-card lift">
      <div className="px-4 pt-3">
        <p className="text-body font-semibold">
          <Link href={`/business/${b.slug}`} className="text-ink">
            {b.name}
          </Link>
          {isVerified ? (
            <>
              {" "}
              <VerifiedBadge />
            </>
          ) : null}
        </p>
        <p className="text-small text-ink-muted">{[b.categoryName, b.place].filter(Boolean).join(" · ")}</p>
        <p className="text-small text-ink-muted">
          {b.phone ? formatPhoneInternational(b.phone) : "No phone"} ·{" "}
          {isVerified && b.verifiedAt
            ? `verified ${formatDateWithYear(b.verifiedAt, ADMIN_TZ)}`
            : b.requestedAt
              ? `applied ${formatDateShort(b.requestedAt, ADMIN_TZ)}`
              : ""}
        </p>
      </div>
      <div className="mt-3 border-t border-border px-4 py-3">
        <DecideForm businessId={b.id} verified={isVerified} />
      </div>
    </li>
  );
}
