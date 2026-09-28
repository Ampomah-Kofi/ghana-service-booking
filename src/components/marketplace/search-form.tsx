import { SearchIcon } from "@/components/ui/icons";
import { NearMeButton } from "./near-me-button";

/**
 * Plain GET form (works without JavaScript and on slow networks), styled as an iOS-style grey
 * search field. The only client-side piece is the optional "Near me" button.
 */
export function SearchForm({ defaultQuery = "", autoFocus = false }: { defaultQuery?: string; autoFocus?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <form action="/search" method="get" role="search" className="relative">
        <label htmlFor="q" className="sr-only">
          Search for a service, business or place
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-muted" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          autoFocus={autoFocus}
          maxLength={100}
          enterKeyHint="search"
          placeholder="Service, business or area"
          className="min-h-12 w-full rounded-full bg-fill pr-4 pl-11 text-body outline-none placeholder:text-ink-muted focus:bg-card focus:ring-2 focus:ring-primary"
        />
        {/* The keyboard's Search key submits; the button stays for screen readers and keyboards. */}
        <button
          type="submit"
          className="sr-only focus:not-sr-only focus:absolute focus:top-1.5 focus:right-1.5 focus:bottom-1.5 focus:rounded-full focus:bg-primary focus:px-4 focus:text-small focus:font-semibold focus:text-on-primary"
        >
          Search
        </button>
      </form>
      <NearMeButton query={defaultQuery} />
    </div>
  );
}
