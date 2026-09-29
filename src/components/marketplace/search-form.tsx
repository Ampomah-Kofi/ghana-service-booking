import { SearchField, type Suggestion } from "./search-field";
import { NearMeButton } from "./near-me-button";

/**
 * Plain GET form (works without JavaScript and on slow networks), styled as an iOS-style grey
 * search field. Suggestions and "Near me" are the client-side extras.
 */
export function SearchForm({
  defaultQuery = "",
  autoFocus = false,
  suggestions = [],
}: {
  defaultQuery?: string;
  autoFocus?: boolean;
  /** Categories and towns for instant suggestions (reference data the page already loaded). */
  suggestions?: Suggestion[];
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <form action="/search" method="get" role="search" className="relative">
        <label htmlFor="q" className="sr-only">
          Search for a service, business or place
        </label>
        <SearchField defaultQuery={defaultQuery} autoFocus={autoFocus} suggestions={suggestions} />
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
