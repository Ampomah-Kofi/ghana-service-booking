import Link from "next/link";
import { PlusIcon } from "./icons";

/**
 * Floating "+" with a small menu (docs/design.md). Built on <details>, so it opens
 * without JavaScript; sits above the bottom tab bar within thumb reach.
 */
export function Fab({ items }: { items: { href: string; label: string; hint?: string }[] }) {
  return (
    <details className="group fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 md:bottom-8">
      <summary
        aria-label="Add"
        className="flex size-14 cursor-pointer list-none items-center justify-center rounded-full bg-primary text-on-primary shadow-pop transition-transform hover:bg-primary-hover group-open:rotate-45 [&::-webkit-details-marker]:hidden"
      >
        <PlusIcon className="size-7" />
      </summary>
      <ul className="absolute right-0 bottom-16 w-60 overflow-hidden rounded-card border border-border bg-card shadow-pop">
        {items.map((item) => (
          <li key={item.href} className="border-b border-border last:border-b-0">
            <Link href={item.href} className="block px-4 py-3 hover:bg-fill">
              <span className="block text-body font-medium">{item.label}</span>
              {item.hint ? <span className="block text-small text-ink-muted">{item.hint}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
