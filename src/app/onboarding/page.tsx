import type { Metadata } from "next";
import Link from "next/link";
import { listMyMemberships, MANAGER_ROLES } from "@/server/auth/roles";
import { requireUserOrRedirect } from "@/server/auth/session";
import { listActiveCategories } from "@/server/catalog/categories";
import { createUserClient } from "@/server/db/supabase-server";
import { CreateBusinessForm } from "./create-business-form";

export const metadata: Metadata = { title: "List your business" };

export default async function OnboardingPage() {
  await requireUserOrRedirect("/onboarding");
  const [categories, memberships] = await Promise.all([
    listActiveCategories(await createUserClient()),
    listMyMemberships(),
  ]);
  const managed = memberships.filter((m) => MANAGER_ROLES.includes(m.role));

  return (
    <div className="mx-auto max-w-lg pt-4">
      <h1 className="text-display font-bold">List your business</h1>
      <p className="mb-6 mt-2 text-body text-ink-muted">
        Get a free booking page you can share on WhatsApp, Instagram and TikTok. It takes about 5 minutes.
      </p>
      {managed.length > 0 ? (
        <p className="mb-6 rounded-control bg-fill px-3 py-2 text-small">
          You already manage {managed.map((m) => m.business.name).join(", ")}.{" "}
          <Link href="/dashboard" className="font-medium text-primary">
            Go to your dashboard
          </Link>
        </p>
      ) : null}
      <CreateBusinessForm categories={categories.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
