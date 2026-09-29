import "server-only";
import { z } from "zod";
import { toAppError } from "@/server/businesses/errors";
import type { Db } from "@/server/db/client";

/**
 * Provider insights (SPEC §16): owners and managers only (the database checks), computed in the
 * business's timezone. Money is integer minor units; "recorded" is what the business marked paid
 * (ADR-0017), "completed value" is the price of visits marked completed.
 */
export const INSIGHT_PERIODS = [7, 30, 90] as const;
export type InsightPeriod = (typeof INSIGHT_PERIODS)[number];

const n = z.coerce.number().int().catch(0);
const insightsSchema = z.object({
  days: n,
  from: z.string(),
  to: z.string(),
  timezone: z.string(),
  currency: z.string(),
  bookings: n,
  by_status: z.record(z.string(), n).catch({}),
  by_source: z.record(z.string(), n).catch({}),
  per_day: z.array(z.object({ day: z.string(), bookings: n, completed: n })).catch([]),
  completed_value_minor: n,
  recorded_minor: n,
  refunded_minor: n,
  top_services: z
    .array(
      z.object({ name: z.string(), count: n, completed_value_minor: z.coerce.number().int().nullable().catch(null) }),
    )
    .catch([]),
  top_staff: z.array(z.object({ name: z.string(), count: n })).catch([]),
  customers: z.object({ total: n, new: n, returning: n }).catch({ total: 0, new: 0, returning: 0 }),
});
export type Insights = z.infer<typeof insightsSchema> & {
  completed: number;
  cancelled: number;
  noShows: number;
  /** Share of all bookings that were cancelled (0–1), or null with no bookings. */
  cancellationRate: number | null;
  /** Share of visits that were due (completed + no-show) where nobody came, or null. */
  noShowRate: number | null;
};

export function parsePeriod(value: unknown): InsightPeriod {
  const days = Number(value);
  return (INSIGHT_PERIODS as readonly number[]).includes(days) ? (days as InsightPeriod) : 30;
}

export async function getInsights(db: Db, businessId: string, days: InsightPeriod): Promise<Insights> {
  const { data, error } = await db.rpc("business_insights", { p_business_id: businessId, p_days: days });
  if (error) throw toAppError(error);
  return withRates(insightsSchema.parse(data));
}

export function withRates(raw: z.infer<typeof insightsSchema>): Insights {
  const completed = raw.by_status.completed ?? 0;
  const cancelled = raw.by_status.cancelled ?? 0;
  const noShows = raw.by_status.no_show ?? 0;
  return {
    ...raw,
    completed,
    cancelled,
    noShows,
    cancellationRate: raw.bookings > 0 ? cancelled / raw.bookings : null,
    noShowRate: completed + noShows > 0 ? noShows / (completed + noShows) : null,
  };
}

/** Daily rows folded into weeks (for 90 days): each bar is 7 days, labelled by its first day. */
export function bucketPerDay(
  perDay: { day: string; bookings: number; completed: number }[],
  size: number,
): { day: string; bookings: number; completed: number }[] {
  if (size <= 1) return perDay;
  const out: { day: string; bookings: number; completed: number }[] = [];
  // Align to the end so the last bucket is the most recent full week.
  const start = perDay.length % size;
  if (start > 0) {
    const head = perDay.slice(0, start);
    out.push({
      day: head[0].day,
      bookings: head.reduce((s, d) => s + d.bookings, 0),
      completed: head.reduce((s, d) => s + d.completed, 0),
    });
  }
  for (let i = start; i < perDay.length; i += size) {
    const chunk = perDay.slice(i, i + size);
    out.push({
      day: chunk[0].day,
      bookings: chunk.reduce((s, d) => s + d.bookings, 0),
      completed: chunk.reduce((s, d) => s + d.completed, 0),
    });
  }
  return out;
}
