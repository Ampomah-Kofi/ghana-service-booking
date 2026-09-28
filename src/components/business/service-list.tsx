import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { formatDuration } from "@/lib/hours";
import type { ServiceView } from "@/server/businesses/catalog";
import { moveServiceAction } from "@/app/dashboard/[businessId]/services/actions";

type Props = {
  businessId: string;
  services: ServiceView[];
  currency: { code: string; symbol: string; minorUnit: number };
  staffNames: Map<string, string> | null;
  editQuery?: string;
};

export function ServiceList({ businessId, services, currency, staffNames, editQuery = "" }: Props) {
  if (services.length === 0) {
    return (
      <p className="rounded-card bg-card p-4 text-body text-ink-muted lift">
        No services yet. Add what you offer, with prices and how long each takes.
      </p>
    );
  }
  return (
    <ul className="ios-list overflow-hidden rounded-card bg-card lift">
      {services.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2 pr-2">
          <Link
            href={`/dashboard/${businessId}/services/${s.id}${editQuery}`}
            className="flex min-h-11 min-w-0 flex-1 flex-col px-4 py-3 hover:bg-fill"
          >
            <span className="truncate text-body font-medium">
              {s.name}
              {s.isActive ? null : (
                <span className="ml-2 rounded-full bg-fill px-2 py-0.5 text-small font-normal text-ink-muted">
                  Hidden
                </span>
              )}
            </span>
            <span className="text-small text-ink-muted tabular-nums">
              {s.priceType === "from" ? "From " : ""}
              {formatMoney({ amountMinor: s.priceMinor, currency: s.currencyCode }, currency)} ·{" "}
              {formatDuration(s.durationMinutes)}
              {staffNames
                ? ` · ${
                    s.staffIds
                      .map((id) => staffNames.get(id))
                      .filter(Boolean)
                      .join(", ") || "Nobody assigned"
                  }`
                : ""}
            </span>
          </Link>
          <form action={moveServiceAction} className="flex flex-col">
            <input type="hidden" name="businessId" value={businessId} />
            <input type="hidden" name="serviceId" value={s.id} />
            <button
              type="submit"
              name="direction"
              value="up"
              disabled={i === 0}
              aria-label={`Move ${s.name} up`}
              className="size-8 text-ink-muted disabled:opacity-30"
            >
              ▲
            </button>
            <button
              type="submit"
              name="direction"
              value="down"
              disabled={i === services.length - 1}
              aria-label={`Move ${s.name} down`}
              className="size-8 text-ink-muted disabled:opacity-30"
            >
              ▼
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
