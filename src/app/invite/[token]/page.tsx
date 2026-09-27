import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui/submit-button";
import { AppError } from "@/lib/errors";
import { requireUserOrRedirect } from "@/server/auth/session";
import { acceptInvite, getInvite } from "@/server/businesses/team";
import { createUserClient } from "@/server/db/supabase-server";

export const metadata: Metadata = { title: "Team invite", robots: { index: false } };

async function acceptAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  let businessId: string;
  try {
    businessId = await acceptInvite(await createUserClient(), token);
  } catch (error) {
    const reason = error instanceof AppError ? error.code : "INTERNAL";
    redirect(`/invite/${token}?error=${reason}`);
  }
  redirect(`/account?joined=${businessId}`);
}

export default async function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  await requireUserOrRedirect(`/invite/${token}`);
  const invite = await getInvite(await createUserClient(), token);

  const card = "rounded-card bg-surface-elevated p-6 shadow-card";
  if (!invite) {
    return (
      <div className={card}>
        <h1 className="text-title-2 font-semibold">Invite not found</h1>
        <p className="mt-2 text-body text-text-secondary">Check the link, or ask for a new invite.</p>
      </div>
    );
  }

  const blocked: Record<Exclude<typeof invite.status, "valid">, string> = {
    used: "This invite has already been used.",
    revoked: "This invite was cancelled. Ask for a new one.",
    expired: "This invite has expired. Ask for a new one.",
    wrong_phone: `This invite is for ${invite.phoneHint}. Sign out and sign in with that number to accept it.`,
  };

  return (
    <div className="mx-auto max-w-sm pt-4">
      <div className={card}>
        <p className="text-footnote font-medium uppercase tracking-wide text-text-secondary">Team invite</p>
        <h1 className="mt-1 text-title-1 font-bold tracking-tight">Join {invite.businessName}</h1>
        <p className="mt-2 text-body text-text-secondary">
          You&apos;ll appear as <strong className="text-text-primary">{invite.staffName}</strong>
          {invite.role === "manager" ? " and can manage the business." : " and see your own bookings."}
        </p>
        {error ? (
          <p role="alert" className="mt-4 rounded-control bg-danger/10 px-3 py-2 text-callout text-danger">
            Couldn&apos;t accept this invite. It may have been used or cancelled.
          </p>
        ) : null}
        {invite.status === "valid" ? (
          <form action={acceptAction} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <SubmitButton pendingLabel="Joining…">Accept invite</SubmitButton>
          </form>
        ) : (
          <p className="mt-4 rounded-control bg-fill px-3 py-2 text-callout">{blocked[invite.status]}</p>
        )}
      </div>
      <p className="mt-4 text-center text-callout">
        <Link href="/" className="font-medium text-accent">
          Not now
        </Link>
      </p>
    </div>
  );
}
