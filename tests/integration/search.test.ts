import { describe, expect, it } from "vitest";
import { searchMarketplace, recentlyJoined } from "@/server/search/marketplace";
import { anonClient } from "./support";

/** Runs against the seeded marketplace (supabase/seed.sql) as an anonymous visitor. */
describe("marketplace search (seed data, anon)", () => {
  const search = (input: Parameters<typeof searchMarketplace>[1]) => searchMarketplace(anonClient(), input, "GH");

  it("understands 'Barber in East Legon'", async () => {
    const result = await search({ q: "Barber in East Legon" });
    expect(result.results.map((r) => r.slug)).toEqual(["kwame-cuts"]);
    expect(result.interpretation).toEqual({
      category: { name: "Barbers", slug: "barbers" },
      place: "East Legon, Accra",
      nearMe: false,
      text: null,
    });
    expect(result.results[0]).toMatchObject({
      categoryName: "Barbers",
      place: "East Legon, Accra",
      startingPrice: { amountMinor: 3000, currency: "GHS" },
    });
  });

  it("widens with an explanation when a town has none yet", async () => {
    const result = await search({ q: "Braids in Accra" });
    expect(result.results.map((r) => r.slug)).toEqual(["ama-braids"]);
    expect(result.notice).toBe("No braids & locs in Accra yet. Here are other places.");
  });

  it("asks for location for 'near me', and sorts by distance when given", async () => {
    expect(await search({ q: "Nails near me" })).toMatchObject({ needsLocation: true });
    const near = await search({ q: "Nails near me", coords: { lat: 5.636, lng: -0.155 } });
    expect(near.needsLocation).toBe(false);
    expect(near.results[0]).toMatchObject({ slug: "glow-nails-east-legon" });
    expect(near.results[0].distanceKm).toBeLessThan(1);
  });

  it("falls back to free text for words that aren't a category", async () => {
    const result = await search({ q: "Kofi" });
    expect(result.interpretation).toMatchObject({ category: null, text: "Kofi" });
    expect(result.results.map((r) => r.slug)).toContain("lens-by-kofi");
  });

  it("says when a place is unknown", async () => {
    const result = await search({ q: "massage", where: "Atlantis" });
    expect(result.notice).toMatch(/couldn't find a place called "Atlantis"/);
    expect(result.results.map((r) => r.slug)).toEqual(["calm-touch-spa"]);
  });

  it("filters by category slug and town", async () => {
    expect((await search({ categorySlug: "photography", where: "Kumasi" })).results.map((r) => r.slug)).toEqual([
      "lens-by-kofi",
    ]);
  });

  it("lists recently joined, newest first, and never drafts", async () => {
    const recent = await recentlyJoined(anonClient(), 20);
    const dates = recent.map((r) => r.publishedAt ?? "");
    expect(dates).toEqual([...dates].sort().reverse());
    expect(recent.map((r) => r.slug)).not.toContain("osu-glow-spa");
  });
});
