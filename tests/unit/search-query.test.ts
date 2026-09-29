import { describe, expect, it } from "vitest";
import { parseCoordinates, parseSearchQuery } from "@/lib/search-query";

describe("parseSearchQuery", () => {
  it.each([
    ["Barber in East Legon", { what: "Barber", where: "East Legon", nearMe: false }],
    ["Braids in Accra", { what: "Braids", where: "Accra", nearMe: false }],
    ["Nails near me", { what: "Nails", where: "", nearMe: true }],
    ["Photographer in Kumasi", { what: "Photographer", where: "Kumasi", nearMe: false }],
    ["Massage", { what: "Massage", where: "", nearMe: false }],
    ["Home cleaning", { what: "Home cleaning", where: "", nearMe: false }],
  ])("SPEC example %j", (input, expected) => {
    expect(parseSearchQuery(input)).toEqual(expected);
  });

  it("splits on the last place word", () => {
    expect(parseSearchQuery("Cuts in Style in Osu")).toEqual({ what: "Cuts in Style", where: "Osu", nearMe: false });
  });
  it("handles a place on its own and extra spaces", () => {
    expect(parseSearchQuery("  in   Tema ")).toEqual({ what: "", where: "Tema", nearMe: false });
    expect(parseSearchQuery("barber at  Adum")).toEqual({ what: "barber", where: "Adum", nearMe: false });
  });
  it("treats 'near me' anywhere as a location request, not a place name", () => {
    expect(parseSearchQuery("massage near me please")).toEqual({ what: "massage please", where: "", nearMe: true });
    expect(parseSearchQuery("nearby tutors")).toEqual({ what: "tutors", where: "", nearMe: true });
  });
  it("caps very long input", () => {
    expect(parseSearchQuery("a".repeat(500)).what).toHaveLength(100);
  });
});

describe("parseCoordinates", () => {
  it("accepts lat,lng and rounds to ~10 m", () => {
    expect(parseCoordinates("5.603712,-0.186964")).toEqual({ lat: 5.6037, lng: -0.187 });
  });
  it.each(["", "abc", "95,0", "5.6", "5.6,-200", "5.6;-0.18"])("rejects %j", (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});
