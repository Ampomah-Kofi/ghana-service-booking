import { SearchIcon } from "@/components/ui/icons";
import { NearMeButton } from "./near-me-button";

/**
 * Plain GET form (works without JavaScript and on slow networks), styled as the app's
 * search pill. The only client-side piece is the optional "Near me" button.
 */
export function SearchForm({ defaultQuery = "", autoFocus = false }: { defaultQuery?: string; autoFocus?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <form action="/search" method="get" role="search" className="relative">
        <label htmlFor="q" className="sr-only">
          Search for a service, business or place
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" />
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          autoFocus={autoFocus}
          maxLength={100}
          enterKeyHint="search"
          placeholder="Service, business or area"
          className="min-h-14 w-full rounded-full border border-border bg-card pr-28 pl-12 text-body shadow-pop outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="pressable absolute top-1.5 right-1.5 bottom-1.5 rounded-full bg-primary px-5 text-small font-semibold text-on-primary hover:bg-primary-hover"
        >
          Search
        </button>
      </form>
      <NearMeButton query={defaultQuery} />
    </div>
  );
}
