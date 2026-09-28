import { StarIcon } from "@/components/ui/icons";

/** Read-only stars, always with the number for screen readers (never colour alone). */
export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className="inline-flex items-center gap-0.5 text-star">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="relative inline-flex">
          <StarIcon filled={false} className={`${className} text-star/40`} />
          {rounded >= n || rounded === n - 0.5 ? (
            <span className={`absolute inset-0 overflow-hidden ${rounded === n - 0.5 ? "w-1/2" : ""}`}>
              <StarIcon className={className} />
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}
