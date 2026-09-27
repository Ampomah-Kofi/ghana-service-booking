import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAllCategories, saveCategory } from "@/server/admin/categories";
import { archiveService, createService, listServices, moveService, updateService } from "@/server/businesses/catalog";
import { createBusiness, getPublishReadiness } from "@/server/businesses/onboarding";
import {
  createBlockedTime,
  deleteBlockedTime,
  getBookingRules,
  getBusinessHours,
  listUpcomingBlockedTimes,
  saveBookingRules,
  setBusinessHours,
} from "@/server/businesses/schedule";
import {
  acceptInvite,
  addStaff,
  getInvite,
  inviteStaff,
  listStaff,
  removeStaff,
  setStaffHours,
} from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { anonClient, cleanup, signedInPhoneUser, signedInUser, type SignedInUser } from "./support";

let owner: SignedInUser;
let outsider: SignedInUser;
let businessId: string;
const cleanupIds: string[] = [];

const service = (overrides: Partial<Parameters<typeof createService>[2]> = {}) => ({
  name: "Knotless braids",
  description: null,
  price: 35000,
  priceType: "from" as const,
  durationMinutes: 240,
  deposit: null,
  isActive: true,
  staffIds: [] as string[],
  ...overrides,
});

beforeAll(async () => {
  owner = await signedInUser("Akua Owner");
  outsider = await signedInUser("Other Owner");
  cleanupIds.push(owner.id, outsider.id);
  const [braids] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "braids-locs");
  businessId = (await createBusiness(owner.db, { kind: "team", name: "Akua Braids", categoryId: braids.id }, "GH")).id;
});

afterAll(async () => {
  await cleanup(cleanupIds);
});

describe("services", () => {
  it("creates services linked to staff, in order, and reports readiness", async () => {
    const [ownerStaff] = await listStaff(owner.db, businessId, { withInvites: false });
    expect(await getPublishReadiness(owner.db, businessId)).toEqual(["location", "contact", "services"]);
    await createService(owner.db, { id: businessId, currencyCode: "GHS" }, service({ staffIds: [ownerStaff.id] }));
    await createService(
      owner.db,
      { id: businessId, currencyCode: "GHS" },
      service({ name: "Twists", price: 25000, staffIds: [ownerStaff.id] }),
    );
    expect(await getPublishReadiness(owner.db, businessId)).toEqual(["location", "contact"]);

    const services = await listServices(owner.db, businessId);
    expect(services.map((s) => s.name)).toEqual(["Knotless braids", "Twists"]);
    expect(services[0]).toMatchObject({
      priceMinor: 35000,
      priceType: "from",
      currencyCode: "GHS",
      staffIds: [ownerStaff.id],
    });

    await moveService(owner.db, businessId, services[1].id, "up");
    expect((await listServices(owner.db, businessId)).map((s) => s.name)).toEqual(["Twists", "Knotless braids"]);
  });

  it("updates, hides and archives", async () => {
    const [twists] = await listServices(owner.db, businessId);
    await updateService(
      owner.db,
      businessId,
      twists.id,
      service({ name: "Twists (medium)", price: 27500, isActive: false }),
    );
    expect(await listServices(owner.db, businessId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Twists (medium)", priceMinor: 27500, isActive: false, staffIds: [] }),
      ]),
    );
    await archiveService(owner.db, businessId, twists.id);
    expect((await listServices(owner.db, businessId)).map((s) => s.name)).toEqual(["Knotless braids"]);
  });

  it("rejects a deposit above the price at the database too", async () => {
    await expect(
      createService(owner.db, { id: businessId, currencyCode: "GHS" }, service({ price: 1000, deposit: 5000 })),
    ).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });

  it("does not let another owner touch the services", async () => {
    const [braids] = await listServices(owner.db, businessId);
    await expect(updateService(outsider.db, businessId, braids.id, service({ price: 1 }))).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(createService(outsider.db, { id: businessId, currencyCode: "GHS" }, service())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await listServices(anonClient(), businessId)).toEqual([]); // draft: public sees nothing
  });
});

describe("hours, time off and booking rules", () => {
  it("replaces the week and reads it back", async () => {
    expect(await getBusinessHours(owner.db, businessId)).toHaveLength(6); // Mon–Sat default
    await setBusinessHours(owner.db, businessId, [
      { weekday: 2, opens: "09:00", closes: "13:00" },
      { weekday: 2, opens: "14:00", closes: "19:00" },
      { weekday: 7, opens: "12:00", closes: "24:00" },
    ]);
    expect(await getBusinessHours(owner.db, businessId)).toEqual(
      expect.arrayContaining([
        { weekday: 2, opens: "09:00", closes: "13:00" },
        { weekday: 2, opens: "14:00", closes: "19:00" },
        { weekday: 7, opens: "12:00", closes: "24:00" },
      ]),
    );
    await expect(setBusinessHours(outsider.db, businessId, [])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adds and removes time off in the business timezone", async () => {
    const day = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
    await createBlockedTime(owner.db, businessId, {
      staffId: null,
      reason: "Public holiday",
      startsLocal: `${day}T00:00`,
      endsLocal: `${day}T12:00`,
    });
    const [block] = await listUpcomingBlockedTimes(owner.db, businessId);
    expect(block).toMatchObject({
      staffId: null,
      reason: "Public holiday",
      startsAt: `${day}T00:00:00.000Z`,
      endsAt: `${day}T12:00:00.000Z`,
    });
    expect(await listUpcomingBlockedTimes(outsider.db, businessId)).toEqual([]);
    await deleteBlockedTime(owner.db, businessId, block.id);
    expect(await listUpcomingBlockedTimes(owner.db, businessId)).toEqual([]);
  });

  it("saves booking rules", async () => {
    await saveBookingRules(owner.db, businessId, {
      slotIntervalMinutes: 30,
      minNoticeMinutes: 120,
      maxAdvanceDays: 30,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      cancellationWindowHours: 24,
      autoConfirm: false,
    });
    expect(await getBookingRules(owner.db, businessId)).toMatchObject({
      slot_interval_minutes: 30,
      buffer_after_minutes: 15,
      auto_confirm: false,
    });
  });
});

describe("team", () => {
  it("adds a member with their own hours and invites them by phone", async () => {
    const staffId = await addStaff(owner.db, businessId, {
      displayName: "Esi",
      roleTitle: "Braider",
      bio: null,
      acceptsOnlineBookings: true,
      serviceIds: [],
    });
    await setStaffHours(owner.db, staffId, false, [{ weekday: 3, opens: "10:00", closes: "16:00" }]);
    expect((await listStaff(owner.db, businessId, { withInvites: false })).find((s) => s.id === staffId)).toMatchObject(
      {
        usesBusinessHours: false,
        hours: [{ weekday: 3, opens: "10:00", closes: "16:00" }],
      },
    );

    const esi = await signedInPhoneUser("Esi Braider");
    const stranger = await signedInPhoneUser("Stranger");
    cleanupIds.push(esi.id, stranger.id);
    const token = await inviteStaff(owner.db, staffId, esi.phone, "staff");

    expect(await getInvite(stranger.db, token)).toMatchObject({ status: "wrong_phone", businessName: "Akua Braids" });
    await expect(acceptInvite(stranger.db, token)).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(await getInvite(esi.db, token)).toMatchObject({ status: "valid", staffName: "Esi", role: "staff" });
    expect(await acceptInvite(esi.db, token)).toBe(businessId);
    expect(await getInvite(esi.db, token)).toMatchObject({ status: "used" });

    // Esi now sees her team but still can't manage it.
    expect((await listStaff(esi.db, businessId, { withInvites: false })).map((s) => s.displayName)).toContain("Esi");
    await expect(setBusinessHours(esi.db, businessId, [])).rejects.toMatchObject({ code: "FORBIDDEN" });

    await removeStaff(owner.db, staffId);
    expect((await listStaff(owner.db, businessId, { withInvites: false })).map((s) => s.displayName)).not.toContain(
      "Esi",
    );
    expect(await listStaff(esi.db, businessId, { withInvites: false })).toEqual([]); // access gone
  });

  it("the owner can't be removed", async () => {
    const ownerStaff = (await listStaff(owner.db, businessId, { withInvites: false })).find(
      (s) => s.userId === owner.id,
    )!;
    await expect(removeStaff(owner.db, ownerStaff.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("admin categories", () => {
  it("refuses non-admins", async () => {
    await expect(
      saveCategory(owner.db, null, {
        name: "X",
        slug: "x-cat",
        description: "",
        keywords: [],
        sortOrder: 1,
        isActive: true,
        reason: "try",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await listAllCategories(owner.db)).every((c) => c.isActive)).toBe(true);
  });
});
