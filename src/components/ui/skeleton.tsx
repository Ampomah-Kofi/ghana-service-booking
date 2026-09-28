/**
 * Loading placeholders shaped like the screen that's coming (docs/design.md: skeletons, not spinners).
 * Server components, zero JavaScript. Pulse is switched off by reduced motion.
 */
export function Bone({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-inner bg-fill ${className}`} />;
}

export function SkeletonScreen({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="animate-pulse">
      {children}
    </div>
  );
}

/** Large title (with optional eyebrow), matching <LargeTitle>. */
export function SkeletonTitle({ eyebrow = false, width = "w-40" }: { eyebrow?: boolean; width?: string }) {
  return (
    <div className="mb-5 pt-3">
      {eyebrow ? <Bone className="mb-2 h-3 w-36" /> : null}
      <Bone className={`h-9 ${width}`} />
    </div>
  );
}

/** An inset grouped list with `rows` two-line rows. */
export function SkeletonList({ rows = 4, className = "mb-8" }: { rows?: number; className?: string }) {
  return (
    <div className={`ios-list overflow-hidden rounded-card bg-card lift ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Bone className="size-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A swipeable row of business cards. */
export function SkeletonCardRow({ className = "mb-8" }: { className?: string }) {
  return (
    <div className={className}>
      <Bone className="mb-3 h-6 w-44" />
      <div className="-mx-5 flex gap-3 overflow-hidden px-5">
        {[0, 1].map((i) => (
          <div key={i} className="w-[64%] max-w-64 shrink-0">
            <Bone className="mb-2.5 aspect-3/2 rounded-card" />
            <Bone className="mb-1.5 h-4 w-3/4" />
            <Bone className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Result rows (picture left, details right), one under another. */
export function SkeletonResults({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-card bg-card p-2.5">
          <Bone className="size-22 shrink-0 rounded-control" />
          <div className="min-w-0 flex-1">
            <Bone className="mb-2 h-4 w-2/3" />
            <Bone className="mb-2 h-3 w-1/2" />
            <Bone className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
