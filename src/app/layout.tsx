import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-separator bg-surface-grouped/80 backdrop-blur supports-[not(backdrop-filter:blur(1px))]:bg-surface-grouped">
          <nav className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4" aria-label="Main">
            <Link href="/" className="text-title-2 font-semibold tracking-tight">
              {BRAND.name}
            </Link>
            <div className="flex items-center gap-5">
              <Link href="/bookings" className="text-callout font-medium text-accent">
                Bookings
              </Link>
              <Link href="/account" className="text-callout font-medium text-accent">
                Account
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
