"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import type { ShareLinks } from "@/lib/share";

const noopSubscribe = () => () => {};

/**
 * Share options (SPEC §6). Native share sheet where the phone supports it,
 * plain links otherwise, and "copy link" for Instagram/TikTok bios.
 */
export function SharePanel({
  url,
  title,
  text,
  links,
}: {
  url: string;
  title: string;
  text: string;
  links: ShareLinks;
}) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  // Server render assumes no share sheet; the browser value takes over after hydration (no mismatch).
  const canNativeShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  const linkClass =
    "flex min-h-11 items-center justify-center rounded-control bg-fill px-3 text-callout font-medium text-text-primary hover:opacity-80";

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      <div className="flex items-center gap-2 rounded-control bg-fill px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-callout" title={url}>
          {url}
        </span>
        <Button type="button" variant="plain" className="shrink-0 px-2" onClick={copy}>
          {copied === "done" ? "Copied" : "Copy link"}
        </Button>
      </div>
      {copied === "failed" ? (
        <p className="text-footnote text-text-secondary" role="status">
          Couldn&apos;t copy automatically. Press and hold the link above to copy it.
        </p>
      ) : null}
      {canNativeShare ? (
        <Button type="button" onClick={() => navigator.share({ title, text, url }).catch(() => undefined)}>
          Share…
        </Button>
      ) : null}
      <div className="grid grid-cols-3 gap-2 [&>a]:min-w-0">
        <a className={linkClass} href={links.whatsapp} target="_blank" rel="noopener noreferrer">
          WhatsApp
        </a>
        <a className={linkClass} href={links.facebook} target="_blank" rel="noopener noreferrer">
          Facebook
        </a>
        <a className={linkClass} href={links.sms}>
          SMS
        </a>
      </div>
      <p className="text-footnote text-text-secondary">
        For Instagram and TikTok, copy the link and add it to your bio.
      </p>
    </div>
  );
}
