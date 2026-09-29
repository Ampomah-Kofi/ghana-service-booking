import "server-only";
import type { Db } from "@/server/db/client";
import { toAppError } from "@/server/businesses/errors";

export type CityOption = { id: string; name: string; regionName: string; areas: { id: string; name: string }[] };

/** Cities (with their areas) for one country, for the location picker. Small reference data. */
export async function listCitiesWithAreas(db: Db, countryCode: string): Promise<CityOption[]> {
  const { data, error } = await db
    .from("cities")
    .select("id, name, regions!inner ( name, country_code ), areas ( id, name )")
    .eq("regions.country_code", countryCode)
    .order("name");
  if (error) throw toAppError(error);
  return data.map((c) => ({
    id: c.id,
    name: c.name,
    regionName: c.regions.name,
    areas: [...c.areas].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
