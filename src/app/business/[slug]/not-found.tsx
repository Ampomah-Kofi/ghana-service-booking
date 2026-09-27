import Link from "next/link";

export default function BusinessNotFound() {
  return (
    <div className="rounded-card bg-surface-elevated p-6 text-center shadow-card">
      <h1 className="text-title-2 font-semibold">We couldn&apos;t find that business</h1>
      <p className="mt-2 text-body text-text-secondary">
        The link may be mistyped, or the business isn&apos;t taking bookings right now.
      </p>
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center font-medium text-accent">
        Browse other professionals
      </Link>
    </div>
  );
}
