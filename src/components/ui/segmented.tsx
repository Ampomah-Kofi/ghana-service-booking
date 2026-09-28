import Link from "next/link";
import { TabLens } from "./tab-lens";

/** iOS-style segmented control made of links (works before JavaScript loads). */
export function Segmented({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="inline-flex rounded-control bg-fill p-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`relative isolate flex min-h-9 min-w-16 items-center justify-center rounded-inner px-3 text-small font-medium transition-colors ${
            item.active ? "text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          {item.active ? (
            <TabLens name={`segment-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} className="rounded-inner" />
          ) : null}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
