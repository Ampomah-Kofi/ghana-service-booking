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
      <div aria-hidden="true" className="h-24 md:hidden" />
      {/* Floating glass capsule (ADR-0010): content scrolls underneath, like current iOS. */}
      <nav aria-label="App" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-5 pb-safe-sm md:hidden">
        <ul className="glass-strong pointer-events-auto mx-auto flex max-w-sm rounded-full p-1.5">
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`pressable flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-full text-caption transition-colors ${
                  active ? "glass-lens font-semibold text-primary" : "text-ink-muted"
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
