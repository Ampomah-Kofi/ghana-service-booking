import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/safe-return-path";
import { getCurrentUser } from "@/server/auth/session";
import { EmailSignInForm } from "./email-sign-in-form";
import { PhoneSignInForm } from "./phone-sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeReturnPath(typeof params.next === "string" ? params.next : undefined);
  const method = params.method === "email" ? "email" : "phone";

  if (await getCurrentUser()) redirect(next);

  const otherMethodHref = `/sign-in?${new URLSearchParams({ next, ...(method === "phone" ? { method: "email" } : {}) })}`;

  return (
    <div className="mx-auto max-w-sm pt-4">
      <h1 className="text-large-title font-bold tracking-tight">Sign in</h1>
      <p className="mb-6 mt-2 text-body text-text-secondary">
        {method === "phone" ? "Use your phone number. No password needed." : "Sign in with your email and password."}
      </p>
      {params.error === "link" ? (
        <p role="alert" className="mb-4 rounded-control bg-danger/10 px-3 py-2 text-callout text-danger">
          That link is invalid or has expired. Please sign in again.
        </p>
      ) : null}
      <div className="rounded-card bg-surface-elevated p-5 shadow-card">
        {method === "phone" ? <PhoneSignInForm next={next} /> : <EmailSignInForm next={next} />}
      </div>
      <p className="mt-6 text-center text-callout">
        <Link href={otherMethodHref} className="font-medium text-accent">
          {method === "phone" ? "Use email instead" : "Use phone number instead"}
        </Link>
      </p>
    </div>
  );
}
