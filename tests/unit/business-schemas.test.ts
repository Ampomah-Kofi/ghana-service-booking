import { describe, expect, it } from "vitest";
import { contactSchema, createBusinessSchema, locationSchema, slugSchema } from "@/schemas/business";

const cityId = "11111111-1111-4111-8111-111111111111";
const areaId = "22222222-2222-4222-8222-222222222222";
const baseLocation = {
  localityText: "",
  areaId: "",
  addressLine: "",
  landmark: "",
  directions: "",
  lat: null,
  lng: null,
};

describe("createBusinessSchema", () => {
  it("trims names and requires a category", () => {
    expect(createBusinessSchema.parse({ kind: "solo", name: "  Kwame Cuts ", categoryId: cityId }).name).toBe(
      "Kwame Cuts",
    );
    expect(createBusinessSchema.safeParse({ kind: "solo", name: "K", categoryId: cityId }).success).toBe(false);
    expect(createBusinessSchema.safeParse({ kind: "company", name: "Kwame", categoryId: cityId }).success).toBe(false);
  });
});

describe("slugSchema", () => {
  it.each([
    ["Kwame-Cuts", "kwame-cuts"],
    [" ama-braids-2 ", "ama-braids-2"],
  ])("normalises %j", (input, out) => {
    expect(slugSchema.parse(input)).toBe(out);
  });
  it.each(["ab", "kwame--cuts", "-kwame", "kwame cuts", "kwamé"])("rejects %j", (input) => {
    expect(slugSchema.safeParse(input).success).toBe(false);
  });
});

describe("locationSchema", () => {
  it("requires a choice of city", () => {
    const result = locationSchema.safeParse({ ...baseLocation, cityChoice: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["cityId"], message: "Choose a town or city." });
  });
  it("requires a town name when the city isn't listed, and drops any area", () => {
    expect(locationSchema.safeParse({ ...baseLocation, cityChoice: "other" }).error?.issues[0].path).toEqual([
      "localityText",
    ]);
    expect(
      locationSchema.parse({ ...baseLocation, cityChoice: "other", localityText: "Nkawkaw", areaId }),
    ).toMatchObject({
      cityId: null,
      areaId: null,
      localityText: "Nkawkaw",
    });
  });
  it("keeps the area for listed cities and blanks optional text", () => {
    expect(
      locationSchema.parse({ ...baseLocation, cityChoice: cityId, areaId, localityText: "ignored" }),
    ).toMatchObject({
      cityId,
      areaId,
      localityText: null,
      landmark: null,
    });
  });
  it("keeps coordinates only as a pair", () => {
    expect(locationSchema.parse({ ...baseLocation, cityChoice: cityId, lat: "5.6", lng: "-0.18" })).toMatchObject({
      lat: 5.6,
      lng: -0.18,
    });
    expect(locationSchema.parse({ ...baseLocation, cityChoice: cityId, lat: "5.6", lng: null })).toMatchObject({
      lat: null,
      lng: null,
    });
    expect(locationSchema.parse({ ...baseLocation, cityChoice: cityId, lat: "999", lng: "0" })).toMatchObject({
      lat: null,
      lng: null,
    });
  });
});

describe("contactSchema", () => {
  const schema = contactSchema("GH");
  it("parses Ghanaian numbers to E.164 and copies the phone to WhatsApp when ticked", () => {
    expect(schema.parse({ phone: "024 123 4567", whatsappSameAsPhone: "on", whatsapp: "", email: "" })).toEqual({
      phone: "+233241234567",
      whatsapp: "+233241234567",
      email: null,
    });
  });
  it("allows WhatsApp only", () => {
    expect(schema.parse({ phone: "", whatsapp: "0551234567", email: "" })).toMatchObject({
      phone: null,
      whatsapp: "+233551234567",
    });
  });
  it("requires at least one number and valid formats", () => {
    expect(schema.safeParse({ phone: "", whatsapp: "", email: "" }).error?.issues[0].path).toEqual(["phone"]);
    expect(schema.safeParse({ phone: "024 123", whatsapp: "", email: "" }).success).toBe(false);
    expect(schema.safeParse({ phone: "0241234567", whatsapp: "", email: "not-an-email" }).success).toBe(false);
  });
});
