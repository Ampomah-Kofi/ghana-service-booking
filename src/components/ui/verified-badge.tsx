/**
 * The verified check (ADR-0015): a green seal with a white tick, shown after a business name only when
 * a platform admin has checked the owner's details. Screen readers hear "Verified business".
 * Sized in em so it follows the name it sits next to.
 */
export function VerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Verified business"
      viewBox="0 0 24 24"
      className={`inline-block size-[0.95em] shrink-0 align-[-0.12em] text-primary ${className}`}
    >
      <title>Verified business</title>
      <polygon
        fill="currentColor"
        strokeLinejoin="round"
        stroke="currentColor"
        strokeWidth="1.6"
        points="12,1.6 14.4,3.2 17.3,3 18.6,5.5 21.1,6.8 20.9,9.7 22.4,12 20.9,14.4 21.1,17.3 18.6,18.6 17.3,21.1 14.4,20.9 12,22.4 9.7,20.9 6.8,21.1 5.5,18.6 3,17.3 3.2,14.4 1.6,12 3.2,9.7 3,6.8 5.5,5.5 6.8,3 9.7,3.2"
      />
      <path
        d="M7.6 12.3l2.9 2.9 5.9-6"
        fill="none"
        stroke="var(--on-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
