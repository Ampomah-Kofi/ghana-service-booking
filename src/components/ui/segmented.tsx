import Link from "next/link";

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
          className={`flex min-h-9 min-w-16 items-center justify-center rounded-inner px-3 text-small font-medium transition-colors ${
            item.active ? "bg-card text-ink shadow-pop" : "text-ink-muted hover:text-ink"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
