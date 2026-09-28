import "server-only";
import { cache } from "react";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export type CurrencyView = { code: string; symbol: string; minorUnit: number };

/** Reference data used to format prices on result cards. */
export const listCurrencies = cache(async (db: Db): Promise<Map<string, CurrencyView>> => {
  const { data, error } = await db.from("currencies").select("code, symbol, minor_unit");
  if (error) throw toAppError(error);
  return new Map(data.map((c) => [c.code, { code: c.code, symbol: c.symbol, minorUnit: c.minor_unit }]));
});

export type CityLink = { name: string; slug: string };

export async function listCities(db: Db, countryCode: string): Promise<CityLink[]> {
  const { data, error } = await db
    .from("cities")
    .select("name, slug, regions!inner(country_code)")
    .eq("regions.country_code", countryCode)
    .order("name");
  if (error) throw toAppError(error);
  return data.map((c) => ({ name: c.name, slug: c.slug }));
}

/** The country's default IANA timezone (reference data), e.g. for "today" on Explore. */
export async function countryTimezone(db: Db, countryCode: string): Promise<string> {
  const { data, error } = await db.from("countries").select("default_timezone").eq("code", countryCode).maybeSingle();
  if (error) throw toAppError(error);
  return data?.default_timezone ?? "UTC";
}
