import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, localToInstant } from "@/lib/availability";
import {
  bookAppointment,
  cancelMyAppointment,
  getAppointment,
  listBusinessUpcoming,
  listMyAppointments,
  rescheduleMyAppointment,
} from "@/server/bookings/appointments";
import { createService } from "@/server/businesses/catalog";
import { createBusiness, publishBusiness, saveContact, saveLocation } from "@/server/businesses/onboarding";
import { createBlockedTime, saveBookingRules, setBusinessHours } from "@/server/businesses/schedule";
import { addStaff, listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { listCitiesWithAreas } from "@/server/catalog/locations";
import { getAvailability, getBookingSetup } from "@/server/scheduling/availability";
import { anonClient, cleanup, signedInUser, type SignedInUser } from "./support";

const TZ = "Africa/Accra";
// A weekday far enough ahead to be inside the booking window whatever "today" is.
const DAY = addDays(new Date().toISOString().slice(0, 10), 7);
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return localToInstant(DAY, h * 60 + m, TZ);
};

let owner: SignedInUser;
let outsider: SignedInUser;
const customers: SignedInUser[] = [];
const cleanupIds: string[] = [];
let business: { id: string; timezone: string };
let fadeId: string; // 60 min, only the owner
let braidsId: string; // 30 min, three people
let ownerStaffId: string;

const newBooking = (overrides: Partial<Parameters<typeof bookAppointment>[2]> = {}) => ({
  businessId: business.id,
  serviceId: fadeId,
  staffId: null,
  startsAt: at("10:00"),
  customerName: "Test Customer",
  customerPhone: "+233241112222",
  note: null,
  idempotencyKey: randomUUID(),
  ...overrides,
});

const times = async (serviceId: string, staffId: string | null = null, db = anonClient()) => {
  const setup = await getBookingSetup(db, business);
  const [day] = await getAvailability(db, setup, { serviceId, staffId, fromDate: DAY, days: 1 });
  return day.slots.map((s) => ({ time: s.start.toISOString().slice(11, 16), staff: s.staffIds.length }));
};

beforeAll(async () => {
  owner = await signedInUser("Booking Owner");
  outsider = await signedInUser("Other Owner");
  cleanupIds.push(owner.id, outsider.id);
  for (let i = 0; i < 20; i++) {
    customers.push(await signedInUser(`Customer ${i}`));
    cleanupIds.push(customers[i].id);
  }

  const [barbers] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "barbers");
  const created = await createBusiness(
    owner.db,
    { kind: "team", name: "Booking Test Barbers", categoryId: barbers.id },
    "GH",
  );
  business = { id: created.id, timezone: TZ };
  const accra = (await listCitiesWithAreas(owner.db, "GH")).find((c) => c.name === "Accra");
  if (!accra) throw new Error("seed city Accra missing");
  await saveLocation(
    owner.db,
    business.id,
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
  await saveContact(owner.db, business.id, { phone: "+233241234567", whatsapp: null, email: null });
  await setBusinessHours(
    owner.db,
    business.id,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens: "09:00", closes: "13:00" })),
  );
  await saveBookingRules(owner.db, business.id, {
    slotIntervalMinutes: 30,
    minNoticeMinutes: 60,
    maxAdvanceDays: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    cancellationWindowHours: 2,
    autoConfirm: true,
  });

  [{ id: ownerStaffId }] = await listStaff(owner.db, business.id, { withInvites: false });
  const service = { description: null, priceType: "fixed" as const, deposit: null, isActive: true };
  fadeId = await createService(
    owner.db,
    { id: business.id, currencyCode: "GHS" },
    { ...service, name: "Skin fade", price: 8000, durationMinutes: 60, staffIds: [ownerStaffId] },
  );
  braidsId = await createService(
    owner.db,
    { id: business.id, currencyCode: "GHS" },
    { ...service, name: "Line up", price: 3000, durationMinutes: 30, staffIds: [ownerStaffId] },
  );
  for (const name of ["Kofi", "Esi"]) {
    await addStaff(owner.db, business.id, {
      displayName: name,
      roleTitle: null,
      bio: null,
      acceptsOnlineBookings: true,
      serviceIds: [braidsId],
    });
  }
  await publishBusiness(owner.db, business.id);
}, 120_000);

afterAll(async () => {
  await cleanup(cleanupIds);
});

describe("availability (anon, published business)", () => {
  it("offers every 30 minutes where the service fits, and 'any' combines people", async () => {
    expect((await times(fadeId)).map((t) => t.time)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
    ]);
    const lineUp = await times(braidsId);
    expect(lineUp).toHaveLength(8);
    expect(lineUp.every((t) => t.staff === 3)).toBe(true);
  });
});

describe("booking", () => {
  let first: string;

  it("books, is idempotent, and the slot disappears for everyone", async () => {
    const input = newBooking();
    first = await bookAppointment(customers[0].db, business, input);
    expect(await bookAppointment(customers[0].db, business, input)).toBe(first);
    const mine = await getAppointment(customers[0].db, first);
    expect(mine).toMatchObject({
      status: "confirmed",
      serviceName: "Skin fade",
      staffId: ownerStaffId,
      price: { amountMinor: 8000 },
    });
    expect((await times(fadeId)).map((t) => t.time)).toEqual(["09:00", "11:00", "11:30", "12:00"]);
  });

  it("keeps bookings private: other customers and other businesses can't read them", async () => {
    expect(await getAppointment(customers[1].db, first)).toBeNull();
    expect(await getAppointment(outsider.db, first)).toBeNull();
    expect(await getAppointment(anonClient(), first)).toBeNull();
    expect((await listBusinessUpcoming(outsider.db, business.id)).length).toBe(0);
    const upcoming = await listBusinessUpcoming(owner.db, business.id);
    expect(upcoming.map((a) => a.id)).toContain(first);
  });

  it("refuses a taken or overlapping time, and times outside hours", async () => {
    await expect(bookAppointment(customers[1].db, business, newBooking())).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      bookAppointment(customers[1].db, business, newBooking({ startsAt: at("10:30") })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      bookAppointment(customers[1].db, business, newBooking({ startsAt: at("12:30") })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("the database refuses an overlap even when the app's pre-check is skipped", async () => {
    const { error } = await customers[1].db.rpc("book_appointment", {
      p_business_id: business.id,
      p_service_id: fadeId,
      p_staff_ids: [ownerStaffId],
      p_starts_at: at("10:30").toISOString(),
      p_customer_name: "Sneaky",
      p_customer_phone: "+233241112223",
    });
    expect(error?.code).toBe("BZ409");
    const direct = await customers[1].db.from("appointments").insert({
      business_id: business.id,
      service_id: fadeId,
      staff_id: ownerStaffId,
      source: "online",
      starts_at: at("10:30").toISOString(),
      ends_at: at("11:30").toISOString(),
      occupied: "[,)",
      service_name: "x",
      price_minor: 0,
      price_type: "fixed",
      currency_code: "GHS",
      customer_name: "x",
    });
    expect(direct.error).not.toBeNull();
  });

  it("parity: a time touching an existing booking is offered by the engine and accepted by the database", async () => {
    const id = await bookAppointment(customers[1].db, business, newBooking({ startsAt: at("09:00") }));
    expect((await getAppointment(customers[1].db, id))?.status).toBe("confirmed");
  });

  it("lists a customer's bookings and lets them reschedule atomically", async () => {
    const before = await listMyAppointments(customers[0].db, customers[0].id);
    expect(before.upcoming.map((a) => a.id)).toEqual([first]);
    const appointment = await getAppointment(customers[0].db, first);
    if (!appointment) throw new Error("missing");

    // The new time is taken (09:00 by customer 1): nothing changes.
    await expect(
      rescheduleMyAppointment(customers[0].db, appointment, { staffId: null, startsAt: at("09:00") }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await getAppointment(customers[0].db, first))?.status).toBe("confirmed");

    const moved = await rescheduleMyAppointment(customers[0].db, appointment, { staffId: null, startsAt: at("12:00") });
    expect((await getAppointment(customers[0].db, first))?.status).toBe("cancelled");
    expect(await getAppointment(customers[0].db, moved)).toMatchObject({ status: "confirmed" });
    expect((await times(fadeId)).map((t) => t.time)).toEqual(["10:00", "10:30", "11:00"]);

    await cancelMyAppointment(customers[0].db, moved, "Travelling");
    expect(await getAppointment(customers[0].db, moved)).toMatchObject({
      status: "cancelled",
      cancellationReason: "Travelling",
    });
    await expect(cancelMyAppointment(customers[1].db, moved, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("time off can't be placed over a booking", async () => {
    await expect(
      createBlockedTime(owner.db, business.id, {
        staffId: ownerStaffId,
        startsLocal: `${DAY}T08:30`,
        endsLocal: `${DAY}T09:30`,
        reason: null,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("concurrency: double booking is impossible (ADR-0003)", () => {
  it("20 customers racing for one person's 11:30 slot: exactly one wins", async () => {
    const results = await Promise.allSettled(
      customers.map((c, i) =>
        bookAppointment(
          c.db,
          business,
          newBooking({ startsAt: at("11:30"), customerPhone: `+2332411130${String(i).padStart(2, "0")}` }),
        ),
      ),
    );
    const won = results.filter((r) => r.status === "fulfilled");
    expect(won).toHaveLength(1);
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONFLICT" });
    }
  });

  it("20 customers racing for 'any available' at 10:00 with three people: exactly three win, on three people", async () => {
    const results = await Promise.allSettled(
      customers.map((c, i) =>
        bookAppointment(
          c.db,
          business,
          newBooking({
            serviceId: braidsId,
            startsAt: at("10:00"),
            customerPhone: `+2332411000${String(i).padStart(2, "0")}`,
          }),
        ),
      ),
    );
    const won = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    expect(won).toHaveLength(3);
    const upcoming = await listBusinessUpcoming(owner.db, business.id, { limit: 50 });
    const atNoon = upcoming.filter((a) => won.includes(a.id));
    expect(new Set(atNoon.map((a) => a.staffId)).size).toBe(3);
  });

  it("direct database calls racing (no app pre-check) still produce one booking", async () => {
    const results = await Promise.all(
      customers.slice(0, 10).map((c, i) =>
        c.db.rpc("book_appointment", {
          p_business_id: business.id,
          p_service_id: braidsId,
          p_staff_ids: [ownerStaffId],
          p_starts_at: at("12:30").toISOString(),
          p_customer_name: `Racer ${i}`,
          p_customer_phone: `+2332411230${String(i).padStart(2, "0")}`,
        }),
      ),
    );
    expect(results.filter((r) => r.error === null)).toHaveLength(1);
    expect(results.filter((r) => r.error?.code === "BZ409")).toHaveLength(9);
  });
});
