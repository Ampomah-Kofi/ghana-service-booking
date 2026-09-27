"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Segmented tabs for the business dashboard. Hidden inside the setup wizard (one task per screen). */
export function DashboardTabs({ businessId, showTeam }: { businessId: string; showTeam: boolean }) {
  const pathname = usePathname();
  const base = `/dashboard/${businessId}`;
  if (pathname.startsWith(`${base}/setup`)) return null;

  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/services`, label: "Services" },
    ...(showTeam ? [{ href: `${base}/team`, label: "Team" }] : []),
    { href: `${base}/hours`, label: "Hours" },
    { href: `${base}/time-off`, label: "Time off" },
    { href: `${base}/settings`, label: "Settings" },
  ];

  return (
    <nav aria-label="Dashboard sections" className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex w-max gap-1 rounded-full bg-fill p-1">
        {tabs.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-9 items-center rounded-full px-3.5 text-small font-medium whitespace-nowrap transition-colors ${
                  active ? "bg-card text-ink border border-border" : "text-ink-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
