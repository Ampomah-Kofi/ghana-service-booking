import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { addPortfolioPhoto, deletePortfolioPhoto, setLogo } from "@/server/businesses/media";
import {
  createBusiness,
  getPublishReadiness,
  publishBusiness,
  saveContact,
  saveLocation,
  setBusinessSlug,
  unpublishBusiness,
  updateAbout,
} from "@/server/businesses/onboarding";
import { getBusinessById, getBusinessBySlug } from "@/server/businesses/queries";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCitiesWithAreas } from "@/server/catalog/locations";
import { anonClient, cleanup, fakeJpeg, fakeWebp, signedInUser, type SignedInUser } from "./support";

let owner: SignedInUser;
let outsider: SignedInUser;
let businessId: string;
let slug: string;

const location = (cityId: string, areaId: string | null) => ({
  cityId,
  areaId,
  localityText: null,
  addressLine: "12 Oxford Street",
  landmark: "Next to the Osu Castle junction",
  directions: null,
  lat: 5.556,
  lng: -0.182,
});

beforeAll(async () => {
  owner = await signedInUser("Esi Owner");
  outsider = await signedInUser("Nana Outsider");
});

afterAll(async () => {
  await cleanup([owner?.id, outsider?.id].filter(Boolean) as string[]);
});

describe("business onboarding services (local Supabase, RLS on)", () => {
  it("creates a draft business with a slug from its name", async () => {
    const [nails] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "nails");
    const created = await createBusiness(
      owner.db,
      { kind: "solo", name: "Esi's Nail Bar", categoryId: nails.id },
      "GH",
    );
    businessId = created.id;
    slug = created.slug;
    expect(slug).toMatch(/^esi-s-nail-bar(-\d+)?$/);

    const business = await getBusinessById(owner.db, businessId);
    expect(business).toMatchObject({ status: "draft", kind: "solo", category: { slug: "nails" } });
    expect(await getPublishReadiness(owner.db, businessId)).toEqual(["location", "contact"]);
  });

  it("keeps drafts private", async () => {
    expect(await getBusinessBySlug(anonClient(), slug)).toBeNull();
    expect(await getBusinessById(outsider.db, businessId)).toBeNull();
  });

  it("refuses to publish until ready", async () => {
    await expect(publishBusiness(owner.db, businessId)).rejects.toMatchObject({
      code: "VALIDATION",
      detail: "location,contact",
    });
  });

  it("saves location, contact and about details", async () => {
    const accra = (await listCitiesWithAreas(owner.db, "GH")).find((c) => c.name === "Accra")!;
    const osu = accra.areas.find((a) => a.name === "Osu")!;
    await saveLocation(owner.db, businessId, location(accra.id, osu.id), "GH");
    await saveLocation(
      owner.db,
      businessId,
      { ...location(accra.id, osu.id), landmark: "Opposite the Osu Mall" },
      "GH",
    ); // update, not duplicate
    await saveContact(owner.db, businessId, { phone: "+233241234567", whatsapp: "+233241234567", email: null });
    const [nails] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "nails");
    await updateAbout(owner.db, businessId, {
      kind: "team",
      name: "Esi's Nail Bar",
      categoryId: nails.id,
      description: "Gel and acrylics.",
    });

    const business = await getBusinessById(owner.db, businessId);
    expect(business?.location).toMatchObject({
      cityName: "Accra",
      areaName: "Osu",
      regionName: "Greater Accra",
      landmark: "Opposite the Osu Mall",
      lat: 5.556,
      lng: -0.182,
    });
    expect(business).toMatchObject({ kind: "team", phone: "+233241234567", description: "Gel and acrylics." });
    expect(await getPublishReadiness(owner.db, businessId)).toEqual([]);
  });

  it("rejects an area from another city", async () => {
    const cities = await listCitiesWithAreas(owner.db, "GH");
    const kumasi = cities.find((c) => c.name === "Kumasi")!;
    const osu = cities.find((c) => c.name === "Accra")!.areas.find((a) => a.name === "Osu")!;
    await expect(saveLocation(owner.db, businessId, location(kumasi.id, osu.id), "GH")).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });

  it("uploads, lists and deletes photos in the business's own folder", async () => {
    await setLogo(owner.db, businessId, fakeWebp("logo.webp"));
    await addPortfolioPhoto(owner.db, businessId, {
      small: fakeJpeg("s.jpg"),
      large: fakeJpeg("l.jpg"),
      width: 1200,
      height: 900,
    });
    const business = await getBusinessById(owner.db, businessId);
    expect(business?.logoPath).toMatch(new RegExp(`^businesses/${businessId}/logo/.+-400\\.webp$`));
    expect(business?.photos).toHaveLength(1);
    expect(business?.photos[0].pathLarge).toMatch(new RegExp(`^businesses/${businessId}/photos/.+-1200\\.jpg$`));

    await deletePortfolioPhoto(owner.db, businessId, business!.photos[0].id);
    expect((await getBusinessById(owner.db, businessId))?.photos).toHaveLength(0);
  });

  it("rejects files that aren't JPEG or WebP, whatever their name says", async () => {
    const svg = new File([new TextEncoder().encode("<svg onload=alert(1)>")], "x.webp", { type: "image/webp" });
    await expect(setLogo(owner.db, businessId, svg)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("publishes, then locks the slug", async () => {
    await publishBusiness(owner.db, businessId);
    const publicView = await getBusinessBySlug(anonClient(), slug);
    expect(publicView).toMatchObject({ status: "published", name: "Esi's Nail Bar" });
    await expect(setBusinessSlug(owner.db, businessId, "esi-nails-accra")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("does not let another user change or upload to the business", async () => {
    await expect(
      saveContact(outsider.db, businessId, { phone: "+233200000099", whatsapp: null, email: null }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(unpublishBusiness(outsider.db, businessId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      addPortfolioPhoto(outsider.db, businessId, {
        small: fakeJpeg("s.jpg"),
        large: fakeJpeg("l.jpg"),
        width: 10,
        height: 10,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const business = await getBusinessById(owner.db, businessId);
    expect(business?.phone).toBe("+233241234567");
    expect(business?.photos).toHaveLength(0);
  });

  it("unpublishing hides the page again", async () => {
    await unpublishBusiness(owner.db, businessId);
    expect(await getBusinessBySlug(anonClient(), slug)).toBeNull();
  });
});
