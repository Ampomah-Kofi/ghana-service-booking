import type { Metadata } from "next";
import { DeleteAccountSheet, EditNameSheet, MessagePreferencesForm } from "./account-forms";
import { getMessagePreferences } from "@/server/notifications/inbox";
import { Stars } from "@/components/reviews/stars";
import { accountDeletionBlocker } from "@/server/account/account";
import { listMyReviews } from "@/server/reviews/reviews";
import { createUserClient } from "@/server/db/supabase-server";
import { LargeTitle } from "@/components/ui/large-title";
import Link from "next/link";
import { GroupedRow, GroupedSection } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatPhoneInternational } from "@/lib/phone";
import { isPlatformAdmin, listMyMemberships, type MemberRole } from "@/server/auth/roles";
import { requireUserOrRedirect } from "@/server/auth/session";
import { getMyProfile } from "@/server/profiles/profile";
import { signOutAction } from "../sign-in/actions";

export const metadata: Metadata = { title: "Account" };

const roleLabel: Record<MemberRole, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

export default async function AccountPage() {
  const user = await requireUserOrRedirect("/account");
  const db = await createUserClient();
  const [profile, memberships, admin, reviews, blocker] = await Promise.all([
    getMyProfile(),
    listMyMemberships(),
    isPlatformAdmin(),
    listMyReviews(db, user.id),
    accountDeletionBlocker(db),
  ]);
  const prefs = await getMessagePreferences(db, user.id);
  const { data: suspension } = await db.rpc("my_suspension");
  const suspended = suspension?.[0] ?? null;

  return (
    <>
      <LargeTitle title={profile?.fullName ?? "Your account"} eyebrow="Account" className="mb-6" />
      {suspended ? (
        <p role="status" className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-body text-danger">
          Your account is suspended, so you can&apos;t make new bookings or write reviews. Your existing bookings are
          still here.{suspended.reason ? ` Reason: ${suspended.reason}` : ""}
        </p>
      ) : null}

      <GroupedSection title="Profile">
        <button type="button" popoverTarget="edit-name" className="block w-full text-left hover:bg-fill">
          <GroupedRow label="Name" value={`${profile?.fullName ?? "Add your name"} ›`} />
        </button>
        <GroupedRow label="Phone" value={user.phone ? formatPhoneInternational(user.phone) : "Not set"} />
        <GroupedRow label="Email" value={user.email ?? "Not set"} />
        {admin ? (
          <>
            <Link href="/admin" className="block hover:bg-fill">
              <GroupedRow label="Admin overview" value="Platform admin ›" />
            </Link>
            <Link href="/admin/categories" className="block hover:bg-fill">
              <GroupedRow label="Categories" value="Platform admin ›" />
            </Link>
            <Link href="/admin/reviews" className="block hover:bg-fill">
              <GroupedRow label="Reported reviews" value="Platform admin ›" />
            </Link>
          </>
        ) : null}
      </GroupedSection>

      <GroupedSection title="Bookings">
        <Link href="/bookings" className="block hover:bg-fill">
          <GroupedRow label="Your bookings" value="›" />
        </Link>
      </GroupedSection>

      <GroupedSection title="Messages" footer="Reminders go out 24 hours and 2 hours before each booking.">
        <MessagePreferencesForm text={prefs.text} email={prefs.email} hasEmail={Boolean(user.email)} />
      </GroupedSection>

      {reviews.length > 0 ? (
        <GroupedSection title="Your reviews">
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/bookings/${r.appointmentId}#rate`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-fill"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">{r.businessName}</span>
                <span className="block truncate text-small text-ink-muted">
                  {r.serviceName}
                  {r.status === "published" ? "" : " · hidden"}
                </span>
              </span>
              <Stars value={r.rating} className="size-3.5" />
            </Link>
          ))}
        </GroupedSection>
      ) : null}

      <GroupedSection
        title="Your businesses"
        footer={
          <Link href="/onboarding" className="font-medium text-primary">
            {memberships.length === 0 ? "List your business for free" : "List another business"}
          </Link>
        }
      >
        {memberships.length === 0 ? (
          <p className="px-4 py-3 text-body text-ink-muted">You don&apos;t manage any businesses yet.</p>
        ) : (
          memberships.map((m) => {
            const value = `${roleLabel[m.role]}${m.business.status === "published" ? "" : ` · ${m.business.status}`}`;
            return m.role === "staff" ? (
              <GroupedRow key={m.businessId} label={m.business.name} value={value} />
            ) : (
              <Link key={m.businessId} href={`/dashboard/${m.businessId}`} className="block hover:bg-fill">
                <GroupedRow label={m.business.name} value={`${value} ›`} />
              </Link>
            );
          })
        )}
      </GroupedSection>

      <form action={signOutAction} className="mb-3">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
      <button
        type="button"
        popoverTarget="delete-account"
        className="flex min-h-12 w-full items-center justify-center rounded-full text-body font-semibold text-danger hover:bg-danger/5"
      >
        Delete account
      </button>
      <EditNameSheet current={profile?.fullName ?? ""} />
      <DeleteAccountSheet blocker={blocker} />
    </>
  );
}
