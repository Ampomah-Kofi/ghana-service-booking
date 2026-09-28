import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDateOf } from "@/lib/availability";
import { createService } from "@/server/businesses/catalog";
import { createBusiness, publishBusiness, saveContact, saveLocation } from "@/server/businesses/onboarding";
import { createBlockedTime, saveBookingRules, setBusinessHours } from "@/server/businesses/schedule";
import { listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCitiesWithAreas } from "@/server/catalog/locations";
import { nextAvailableToday } from "@/server/scheduling/next-available";
import { bookAppointment, cancelMyAppointment } from "@/server/bookings/appointments";
import { listMyPlaces } from "@/server/bookings/places";
import { addDays, localToInstant } from "@/lib/availability";
import { anonClient, cleanup, signedInUser, type SignedInUser } from "./support";

const TZ = "Africa/Accra";
let owner: SignedInUser;
let open24: string; // published, open all day every day, no notice
let draft: string;
let staffId: string;
let serviceId: string;

async function setUp(name: string, publish: boolean): Promise<string> {
  const [barbers] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "barbers");
  const { id } = await createBusiness(owner.db, { kind: "solo", name, categoryId: barbers.id }, "GH");
  const accra = (await listCitiesWithAreas(owner.db, "GH")).find((c) => c.name === "Accra");
  if (!accra) throw new Error("seed city Accra missing");
  await saveLocation(
    owner.db,
    id,
    {
      cityId: accra.id,
      areaId: null,
      localityText: null,
      addressLine: "1 Test Road",
      landmark: null,
      directions: null,
      lat: null,
      lng: null,
    },
    "GH",
  );
  await saveContact(owner.db, id, { phone: "+233241234567", whatsapp: null, email: null });
  await setBusinessHours(
    owner.db,
    id,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens: "00:00", closes: "24:00" })),
  );
  await saveBookingRules(owner.db, id, {
    slotIntervalMinutes: 5,
    minNoticeMinutes: 0,
    maxAdvanceDays: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    cancellationWindowHours: 2,
    autoConfirm: true,
  });
  const [{ id: sid }] = await listStaff(owner.db, id, { withInvites: false });
  staffId = sid;
  serviceId = await createService(
    owner.db,
    { id, currencyCode: "GHS" },
    {
      name: "Quick trim",
      description: null,
      price: 2000,
      priceType: "fixed",
      durationMinutes: 10,
      deposit: null,
      isActive: true,
      staffIds: [sid],
    },
  );
  if (publish) await publishBusiness(owner.db, id);
  return id;
}

beforeAll(async () => {
  owner = await signedInUser("Discovery Owner");
  draft = await setUp("Discovery Draft", false);
  open24 = await setUp("Discovery Always Open", true);
}, 60_000);

afterAll(async () => {
  await cleanup([owner?.id].filter(Boolean) as string[]);
});

describe("available today (anon, bulk)", () => {
  it("finds the next free time today in the business's timezone, and never shows drafts", async () => {
    const now = new Date();
    const result = await nextAvailableToday(anonClient(), [open24, draft], now);
    expect(result.has(draft)).toBe(false);
    const next = result.get(open24);
    // Open 24/7 with 10-minute services: there is a slot today unless it's in the last 10 minutes of the day.
    if (next) {
      expect(next.at.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(next.at.getTime() - now.getTime()).toBeLessThan(10 * 60_000);
      expect(localDateOf(next.at, TZ)).toBe(localDateOf(now, TZ));
      expect(next.label).toMatch(/^Today \d{1,2}:\d{2} (am|pm)$/);
    }
  });

  it("drops a business whose rest of today is blocked off", async () => {
    const now = new Date();
    const today = localDateOf(now, TZ);
    const tomorrow = localDateOf(new Date(now.getTime() + 86_400_000), TZ);
    const nowLocal = new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
    await createBlockedTime(owner.db, open24, {
      staffId,
      startsLocal: `${today}T${nowLocal}`,
      endsLocal: `${tomorrow}T00:00`,
      reason: "Closed early",
    });
    const result = await nextAvailableToday(anonClient(), [open24]);
    expect(result.has(open24)).toBe(false);
  });

  it("returns nothing for nothing", async () => {
    expect((await nextAvailableToday(anonClient(), [])).size).toBe(0);
  });
});

describe("your places", () => {
  it("lists businesses the customer booked, with the last service for one-tap rebooking; cancelled ones don't count", async () => {
    const customer = await signedInUser("Places Customer");
    try {
      expect(await listMyPlaces(customer.db, customer.id)).toEqual([]);
      const tomorrow = addDays(localDateOf(new Date(), TZ), 1);
      const booking = (hour: number) =>
        bookAppointment(
          customer.db,
          { id: open24, timezone: TZ },
          {
            businessId: open24,
            serviceId,
            staffId,
            startsAt: localToInstant(tomorrow, hour * 60, TZ),
            customerName: "Places Customer",
            customerPhone: "+233241119999",
            note: null,
            idempotencyKey: crypto.randomUUID(),
          },
        );
      const cancelled = await booking(10);
      await cancelMyAppointment(customer.db, cancelled, null);
      expect(await listMyPlaces(customer.db, customer.id)).toEqual([]);

      await booking(11);
      const places = await listMyPlaces(customer.db, customer.id);
      expect(places).toHaveLength(1);
      expect(places[0]).toMatchObject({
        businessId: open24,
        name: "Discovery Always Open",
        lastServiceName: "Quick trim",
        lastServiceId: serviceId,
        lastStaffId: staffId,
        timezone: TZ,
        upcoming: true,
      });
      // Another customer can't see someone else's places (RLS: customers read only their own bookings).
      const stranger = await signedInUser("Nosy Customer");
      try {
        expect(await listMyPlaces(stranger.db, customer.id)).toEqual([]);
      } finally {
        await cleanup([stranger.id]);
      }
    } finally {
      await cleanup([customer.id]);
    }
  });
});
