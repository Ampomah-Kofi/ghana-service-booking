import Link from "next/link";

export const SETUP_STEPS = [
  { slug: "about", title: "About" },
  { slug: "location", title: "Location" },
  { slug: "contact", title: "Contact" },
  { slug: "services", title: "Services" },
  { slug: "hours", title: "Hours" },
  { slug: "photos", title: "Photos" },
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number]["slug"];

/** "Step 2 of 4" with a progress bar (docs/design.md: clarity, one task per screen). */
export function StepHeader({
  businessId,
  step,
  title,
  subtitle,
}: {
  businessId: string;
  step: SetupStep;
  title: string;
  subtitle: string;
}) {
  const index = SETUP_STEPS.findIndex((s) => s.slug === step);
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between text-footnote text-text-secondary">
        <span>
          Step {index + 1} of {SETUP_STEPS.length}
        </span>
        <Link href={`/dashboard/${businessId}`} className="font-medium text-accent">
          Save for later
        </Link>
      </div>
      <div
        className="mb-5 h-1 overflow-hidden rounded-full bg-fill"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={SETUP_STEPS.length}
        aria-valuenow={index + 1}
        aria-label="Setup progress"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${((index + 1) / SETUP_STEPS.length) * 100}%` }}
        />
      </div>
      <h1 className="text-large-title font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-body text-text-secondary">{subtitle}</p>
    </div>
  );
}

export function nextStepHref(businessId: string, step: SetupStep): string {
  const index = SETUP_STEPS.findIndex((s) => s.slug === step);
  const next = SETUP_STEPS[index + 1];
  return next ? `/dashboard/${businessId}/setup/${next.slug}` : `/dashboard/${businessId}?setup=done`;
}
