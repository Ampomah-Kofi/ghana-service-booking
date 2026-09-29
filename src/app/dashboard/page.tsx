import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupedSection } from "@/components/ui/card";
import { listMyMemberships, MANAGER_ROLES } from "@/server/auth/roles";
import { requireUserOrRedirect } from "@/server/auth/session";

export const metadata: Metadata = { title: "Your businesses" };

export default async function DashboardIndexPage() {
  await requireUserOrRedirect("/dashboard");
  const managed = (await listMyMemberships()).filter((m) => MANAGER_ROLES.includes(m.role));
  if (managed.length === 0) redirect("/onboarding");
  if (managed.length === 1) redirect(`/dashboard/${managed[0].businessId}`);

  return (
    <>
      <h1 className="mb-6 text-display font-bold">Your businesses</h1>
      <GroupedSection>
        {managed.map((m) => (
          <Link
            key={m.businessId}
            href={`/dashboard/${m.businessId}`}
            className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 hover:bg-fill"
          >
            <span className="text-body">{m.business.name}</span>
            <span className="text-small text-ink-muted">{m.business.status}</span>
          </Link>
        ))}
      </GroupedSection>
      <Link href="/onboarding" className="text-body font-medium text-primary">
        List another business
      </Link>
    </>
  );
}
