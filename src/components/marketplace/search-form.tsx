import { NearMeButton } from "./near-me-button";

/**
 * Plain GET form (works without JavaScript and on slow networks). The only
 * client-side piece is the optional "Near me" button.
 */
export function SearchForm({ defaultQuery = "", autoFocus = false }: { defaultQuery?: string; autoFocus?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <form action="/search" method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search for a service, business or place
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={defaultQuery}
          autoFocus={autoFocus}
          maxLength={100}
          enterKeyHint="search"
          placeholder="Try “Barber in East Legon”"
          className="min-h-12 min-w-0 flex-1 rounded-full border border-border bg-card px-5 text-body border border-border outline-none focus:border-primary"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-full bg-primary px-5 text-body font-semibold text-on-primary hover:bg-primary-hover"
        >
          Search
        </button>
      </form>
      <NearMeButton query={defaultQuery} />
    </div>
  );
}
