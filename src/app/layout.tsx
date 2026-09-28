import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { CustomerTabs } from "@/components/ui/customer-tabs";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: BRAND.tagline,
  applicationName: BRAND.name,
  // Installable from the browser ("Add to Home Screen"): full screen, own icon (src/app/manifest.ts).
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#121512" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        {/* Website header from tablet width; on phones each screen has its own large title and the app tab bar. */}
        <header className="sticky top-0 z-10 hidden border-b border-border bg-surface md:block">
          <nav className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4" aria-label="Main">
            <Link href="/" className="text-title font-bold tracking-tight">
              {BRAND.name}
            </Link>
            <div className="flex items-center gap-6">
              <Link href="/" className="text-small font-medium text-ink-muted hover:text-ink">
                Explore
              </Link>
              <Link href="/bookings" className="text-small font-medium text-ink-muted hover:text-ink">
                Bookings
              </Link>
              <Link href="/account" className="text-small font-medium text-ink-muted hover:text-ink">
                Account
              </Link>
              <Link
                href="/onboarding"
                className="rounded-full border border-border px-4 py-2 text-small font-semibold hover:bg-fill"
              >
                List your business
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-safe pb-10 md:pt-8">{children}</main>
        <CustomerTabs />
      </body>
    </html>
  );
}
