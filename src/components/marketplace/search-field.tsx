"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ClockIcon, CompassIcon, MapPinIcon, SearchIcon, XIcon } from "@/components/ui/icons";

export type Suggestion = { label: string; href: string; kind: "category" | "town" };

const KEY = "hyia:recent-searches";
const MAX_RECENT = 6;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Private mode or storage blocked: recent searches are a nicety.
  }
}

/**
 * The search input with an iOS-style suggestions panel (ADR-0012): your recent searches (kept on
 * this phone only) and matching categories and towns (reference data passed in, no extra request).
 * Without JavaScript it's a plain input in the surrounding GET form.
 */
export function SearchField({
  defaultQuery,
  autoFocus,
  suggestions,
}: {
  defaultQuery: string;
  autoFocus: boolean;
  suggestions: Suggestion[];
}) {
  const panelId = useId();
  const [query, setQuery] = useState(defaultQuery);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    const input = document.getElementById("q");
    const form = input?.closest("form");
    const onSubmit = () => {
      const value = (input as HTMLInputElement | null)?.value.trim();
      if (value) writeRecent([value, ...readRecent().filter((r) => r.toLowerCase() !== value.toLowerCase())]);
    };
    form?.addEventListener("submit", onSubmit);
    return () => form?.removeEventListener("submit", onSubmit);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? suggestions.filter((s) => s.label.toLowerCase().includes(q)).slice(0, 6)
    : suggestions.filter((s) => s.kind === "category").slice(0, 4);
  const recentShown = q ? recent.filter((r) => r.toLowerCase().includes(q)).slice(0, 3) : recent;
  const showPanel = open && (matches.length > 0 || recentShown.length > 0);

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-muted" />
      <input
        id="q"
        name="q"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        autoFocus={autoFocus}
        maxLength={100}
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Service, business or area"
        aria-controls={panelId}
        className="min-h-12 w-full rounded-full bg-fill pr-4 pl-11 text-body outline-none placeholder:text-ink-muted focus:bg-card focus:ring-2 focus:ring-primary"
      />
      <div
        id={panelId}
        hidden={!showPanel}
        className="sheet-up absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-card bg-card shadow-pop"
      >
        {recentShown.length > 0 ? (
          <section aria-label="Recent searches">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <h2 className="text-small font-semibold text-ink-muted">Recent</h2>
              <button
                type="button"
                onClick={() => {
                  writeRecent([]);
                  setRecent([]);
                }}
                className="min-h-9 text-small font-medium text-primary"
              >
                Clear
              </button>
            </div>
            <ul className="ios-list">
              {recentShown.map((r) => (
                <li key={r}>
                  <Link href={`/search?q=${encodeURIComponent(r)}`} className={ROW}>
                    <ClockIcon className="size-4.5 shrink-0 text-ink-muted" />
                    <span className="truncate">{r}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {matches.length > 0 ? (
          <section aria-label="Suggestions">
            <h2 className="px-4 pt-3 pb-1 text-small font-semibold text-ink-muted">{q ? "Suggestions" : "Popular"}</h2>
            <ul className="ios-list">
              {matches.map((s) => (
                <li key={s.href}>
                  <Link href={s.href} className={ROW}>
                    {s.kind === "town" ? (
                      <MapPinIcon className="size-4.5 shrink-0 text-ink-muted" />
                    ) : (
                      <CompassIcon className="size-4.5 shrink-0 text-ink-muted" />
                    )}
                    <span className="truncate">{s.label}</span>
                    <span className="ml-auto text-small text-ink-muted">{s.kind === "town" ? "Town" : "Category"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-border text-small font-medium text-ink-muted"
        >
          <XIcon className="size-4" /> Close
        </button>
      </div>
    </div>
  );
}

const ROW = "flex min-h-11 items-center gap-3 px-4 py-2 text-body hover:bg-fill";
