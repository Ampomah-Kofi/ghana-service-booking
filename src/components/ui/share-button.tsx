"use client";

import { useState, type ReactNode } from "react";

/**
 * Opens the phone's own share sheet (Web Share API). Without it, the link simply goes to
 * `fallbackHref` (e.g. the page's share section), or copies the link. Works before JavaScript loads.
 */
export function ShareButton({
  url,
  title,
  text,
  fallbackHref,
  className,
  children,
  label,
}: {
  url: string;
  title: string;
  text?: string;
  fallbackHref?: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <a
      href={fallbackHref ?? url}
      aria-label={copied ? "Link copied" : label}
      className={className}
      onClick={async (e) => {
        if (typeof navigator.share === "function") {
          e.preventDefault();
          await navigator.share({ title, text, url }).catch(() => undefined);
        } else if (!fallbackHref && navigator.clipboard) {
          e.preventDefault();
          await navigator.clipboard.writeText(url).then(
            () => setCopied(true),
            () => undefined,
          );
          window.setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      {children}
    </a>
  );
}
