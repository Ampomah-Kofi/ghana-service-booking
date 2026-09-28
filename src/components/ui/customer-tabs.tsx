"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CompassIcon, TicketIcon, UserIcon } from "./icons";

/** Screens with their own bottom bar or a focused flow don't show the customer tabs. */
const HIDDEN = ["/dashboard", "/business/", "/onboarding", "/admin", "/invite"];

/**
 * The customer app's bottom tab bar on phones (docs/design.md): Explore · Bookings · Account.
 * Favourites joins in Phase 7. Desktop keeps the top header instead.
 */
export function CustomerTabs() {
  const pathname = usePathname();
  const away = useTucksAway();
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
        <ul
          className={`glass-strong pointer-events-auto mx-auto flex max-w-sm rounded-full p-1.5 transition-[transform,opacity] duration-300 ease-out ${
            away ? "tabs-away" : ""
          }`}
        >
          {tabs.map(({ href, label, icon: Icon, active }) => (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                // Tapping the tab you're on scrolls back to the top, like iOS.
                onClick={(e) => {
                  if (active && pathname === href) {
                    e.preventDefault();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
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

/**
 * True while the user scrolls down past the first screen; false as soon as they scroll up
 * (or reach the bottom), so the bar is never in the way and never lost.
 */
function useTucksAway() {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 8;
        if (Math.abs(y - last) > 6) setAway(y > last && y > 240 && !atBottom);
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return away;
}
