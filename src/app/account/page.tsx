import type { Metadata } from "next";
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
  const [profile, memberships, admin] = await Promise.all([getMyProfile(), listMyMemberships(), isPlatformAdmin()]);

  return (
    <>
      <h1 className="mb-6 text-large-title font-bold tracking-tight">{profile?.fullName ?? "Your account"}</h1>

      <GroupedSection title="Profile">
        <GroupedRow label="Phone" value={user.phone ? formatPhoneInternational(user.phone) : "Not set"} />
        <GroupedRow label="Email" value={user.email ?? "Not set"} />
        {admin ? <GroupedRow label="Access" value="Platform admin" /> : null}
      </GroupedSection>

      <GroupedSection
        title="Your businesses"
        footer={
          <Link href="/onboarding" className="font-medium text-accent">
            {memberships.length === 0 ? "List your business for free" : "List another business"}
          </Link>
        }
      >
        {memberships.length === 0 ? (
          <p className="px-4 py-3 text-body text-text-secondary">You don&apos;t manage any businesses yet.</p>
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

      <form action={signOutAction}>
        <Button
          type="submit"
          variant="plain"
          className="w-full rounded-card bg-surface-elevated text-danger shadow-card"
        >
          Sign out
        </Button>
      </form>
    </>
  );
}
