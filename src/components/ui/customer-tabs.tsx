"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CompassIcon, TicketIcon, UserIcon } from "./icons";

/** Screens with their own bottom bar or a focused flow don't show the customer tabs. */
const HIDDEN = ["/dashboard", "/business/", "/onboarding", "/admin", "/invite"];

/**
 * The customer app's bottom tab bar on phones (docs/design.md): Explore · Bookings · Account.
 * Favourites joins in Phase 7. Desktop keeps the top header instead.
 */
export function CustomerTabs() {
  const pathname = usePathname();
  if (HIDDEN.some((prefix) => pathname.startsWith(prefix))) return null;

  const tabs = [
    {
      href: "/",
      label: "Explore",
      icon: CompassIcon,
      active: pathname === "/" || pathname.startsWith("/search") || pathname.startsWith("/categories"),
    },
    { href: "/bookings", label: "Bookings", icon: TicketIcon, active: pathname.startsWith("/bookings") },
    {
      href: "/account",
      label: "Account",
      icon: UserIcon,
      active: pathname.startsWith("/account") || pathname.startsWith("/sign-in"),
    },
  ];

  return (
    <>
      <div aria-hidden="true" className="h-20 md:hidden" />
      <nav aria-label="App" className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-safe md:hidden">
        <ul className="mx-auto flex max-w-2xl">
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption ${
                  active ? "font-semibold text-primary" : "text-ink-muted"
                }`}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
