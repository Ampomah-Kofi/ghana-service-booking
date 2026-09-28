"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, MoreIcon, SunIcon, UsersIcon } from "@/components/ui/icons";

/**
 * Provider navigation (docs/design.md): Today · Calendar · Clients · More.
 * A bottom tab bar on phones, a segmented bar at the top from tablet width.
 * Staff get Today and Calendar only. Hidden in the setup wizard (one task per screen).
 */
export function ProviderTabs({ businessId, canManage }: { businessId: string; canManage: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/${businessId}`;
  if (pathname.startsWith(`${base}/setup`)) return null;

  const tabs = [
    { href: base, label: "Today", icon: SunIcon, match: (p: string) => p === base },
    {
      href: `${base}/calendar`,
      label: "Calendar",
      icon: CalendarIcon,
      match: (p: string) => p.startsWith(`${base}/calendar`) || p.startsWith(`${base}/appointments`),
    },
    ...(canManage
      ? [
          {
            href: `${base}/clients`,
            label: "Clients",
            icon: UsersIcon,
            match: (p: string) => p.startsWith(`${base}/clients`),
          },
          {
            href: `${base}/more`,
            label: "More",
            icon: MoreIcon,
            match: (p: string) =>
              ["more", "services", "team", "hours", "time-off", "settings"].some((s) => p.startsWith(`${base}/${s}`)),
          },
        ]
      : []),
  ];

  return (
    <>
      <nav
        aria-label="Business"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-safe md:hidden"
      >
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption ${
                    active ? "text-primary" : "text-ink-muted"
                  }`}
                >
                  <Icon className="size-6" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav aria-label="Business sections" className="mb-6 hidden md:block">
        <ul className="inline-flex gap-1 rounded-control bg-fill p-0.5">
          {tabs.map(({ href, label, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-9 items-center rounded-inner px-4 text-small font-medium ${
                    active ? "bg-card text-ink shadow-pop" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
