import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, localToInstant } from "@/lib/availability";
import type { MemberBusiness } from "@/server/businesses/access";
import { getAppointment, getAppointmentHistory, listClientAppointments } from "@/server/bookings/appointments";
import { getCalendarRange } from "@/server/bookings/calendar";
import { addManualAppointment, moveAppointment, setAppointmentStatus } from "@/server/bookings/manage";
import { getTodaySummary } from "@/server/bookings/today";
import { createService } from "@/server/businesses/catalog";
import { createBusiness } from "@/server/businesses/onboarding";
import { getBusinessById } from "@/server/businesses/queries";
import { setBusinessHours } from "@/server/businesses/schedule";
import { acceptInvite, addStaff, inviteStaff, listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { listClients, saveClient } from "@/server/clients/clients";
import { cleanup, signedInPhoneUser, signedInUser, type SignedInUser } from "./support";

const TZ = "Africa/Accra";
const DAY = addDays(new Date().toISOString().slice(0, 10), 7);
const at = (hhmm: string, date = DAY) => {
  const [h, m] = hhmm.split(":").map(Number);
  return localToInstant(date, h * 60 + m, TZ);
};

let owner: SignedInUser;
let staffUser: SignedInUser & { phone: string };
let outsider: SignedInUser;
const cleanupIds: string[] = [];
let businessId: string;
let ownerStaffId: string;
let esiStaffId: string;
let cutId: string;

async function member(user: SignedInUser, canManage: boolean, ownStaffId: string | null): Promise<MemberBusiness> {
  const business = await getBusinessById(user.db, businessId);
  if (!business) throw new Error("business not visible");
  return { db: user.db, business, role: canManage ? "owner" : "staff", canManage, ownStaffId };
}

const walkIn = (overrides: Partial<Parameters<typeof addManualAppointment>[2]> = {}) => ({
  serviceId: cutId,
  staffId: ownerStaffId,
  startsAt: at("10:00"),
  client: { name: "Kofi Walk-in", phone: "+233244100001" },
  note: null,
  walkIn: false,
  allowOutsideHours: false,
  ...overrides,
});

beforeAll(async () => {
  owner = await signedInUser("Calendar Owner");
  outsider = await signedInUser("Other Owner");
  staffUser = await signedInPhoneUser("Esi Staff");
  cleanupIds.push(owner.id, outsider.id, staffUser.id);
  const [barbers] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "barbers");
  businessId = (
    await createBusiness(owner.db, { kind: "team", name: "Calendar Test Cuts", categoryId: barbers.id }, "GH")
  ).id;
  await setBusinessHours(
    owner.db,
    businessId,
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens: "09:00", closes: "18:00" })),
  );
  [{ id: ownerStaffId }] = await listStaff(owner.db, businessId, { withInvites: false });
  cutId = await createService(
    owner.db,
    { id: businessId, currencyCode: "GHS" },
    {
      name: "Cut",
      description: null,
      price: 5000,
      priceType: "from",
      durationMinutes: 30,
      deposit: null,
      isActive: true,
      staffIds: [ownerStaffId],
    },
  );
  esiStaffId = await addStaff(owner.db, businessId, {
    displayName: "Esi",
    roleTitle: "Barber",
    bio: null,
    acceptsOnlineBookings: true,
    serviceIds: [cutId],
  });
  await acceptInvite(staffUser.db, await inviteStaff(owner.db, esiStaffId, staffUser.phone, "staff"));
}, 60_000);

afterAll(async () => {
  await cleanup(cleanupIds);
});

describe("provider appointment management", () => {
  let phoneBooking: string;

  it("adds a phone booking and shows it in the owner's calendar", async () => {
    phoneBooking = await addManualAppointment(owner.db, businessId, walkIn());
    const calendar = await getCalendarRange(await member(owner, true, ownerStaffId), { from: DAY, days: 1 });
    expect(calendar.staff.map((s) => s.displayName)).toEqual(["Calendar Owner", "Esi"]);
    expect(calendar.working.get(`${ownerStaffId}|${DAY}`)).toEqual([{ from: 540, to: 1080 }]);
    expect(calendar.appointments.map((a) => [a.id, a.status, a.source])).toEqual([
      [phoneBooking, "confirmed", "manual"],
    ]);
  });

  it("gives clear errors: overlap, outside hours (unless overridden), outsiders", async () => {
    await expect(addManualAppointment(owner.db, businessId, walkIn({ startsAt: at("10:15") }))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That person already has a booking then.",
    });
    await expect(addManualAppointment(owner.db, businessId, walkIn({ startsAt: at("19:00") }))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "That's outside working hours.",
    });
    expect(
      await addManualAppointment(owner.db, businessId, walkIn({ startsAt: at("19:00"), allowOutsideHours: true })),
    ).toBeTruthy();
    await expect(
      addManualAppointment(outsider.db, businessId, walkIn({ startsAt: at("12:00") })),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("staff see only their own column and bookings", async () => {
    const own = await addManualAppointment(
      staffUser.db,
      businessId,
      walkIn({ staffId: esiStaffId, startsAt: at("10:00") }),
    );
    await expect(
      addManualAppointment(staffUser.db, businessId, walkIn({ staffId: ownerStaffId, startsAt: at("13:00") })),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const calendar = await getCalendarRange(await member(staffUser, false, esiStaffId), { from: DAY, days: 1 });
    expect(calendar.staff.map((s) => s.id)).toEqual([esiStaffId]);
    expect(calendar.appointments.map((a) => a.id)).toEqual([own]);
    expect(await listClients(staffUser.db, businessId)).toEqual([]);
  });

  it("moves a booking to another person and records it", async () => {
    await moveAppointment(owner.db, phoneBooking, { staffId: esiStaffId, startsAt: at("11:00") });
    expect(await getAppointment(owner.db, phoneBooking)).toMatchObject({ staffId: esiStaffId, staffName: "Esi" });
    const history = await getAppointmentHistory(owner.db, phoneBooking);
    expect(history.at(-1)?.reason).toMatch(/^Moved from .* \(Calendar Owner\)$/);
    await expect(
      moveAppointment(staffUser.db, phoneBooking, { staffId: esiStaffId, startsAt: at("12:00") }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("today: a walk-in is added, completed with its final price, and counted", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const id = await addManualAppointment(
      owner.db,
      businessId,
      walkIn({
        startsAt: new Date(now.getTime() - 60_000),
        walkIn: true,
        allowOutsideHours: true,
        client: { name: "Ama Walk-in", phone: null },
      }),
    );
    expect((await getAppointment(owner.db, id))?.status).toBe("arrived");
    await setAppointmentStatus(owner.db, id, "completed", { finalPriceMinor: 7000 });
    await expect(setAppointmentStatus(owner.db, id, "cancelled")).rejects.toMatchObject({ code: "CONFLICT" });

    const summary = await getTodaySummary(await member(owner, true, ownerStaffId));
    expect(summary.date).toBe(today);
    expect(summary.counts).toMatchObject({ completed: 1, walkIns: 1 });
    expect(summary.expectedRevenueMinor).toBeGreaterThanOrEqual(7000);
    expect(summary.recentClients.map((c) => c.name)).toContain("Ama Walk-in");
  });

  it("clients: listed with stats, searchable by name or phone, editable, private to the business", async () => {
    const clients = await listClients(owner.db, businessId);
    expect(clients.map((c) => c.name)).toEqual(expect.arrayContaining(["Kofi Walk-in", "Ama Walk-in"]));
    expect((await listClients(owner.db, businessId, { search: "kofi" })).map((c) => c.name)).toEqual(["Kofi Walk-in"]);
    expect((await listClients(owner.db, businessId, { search: "0244 100 001" })).map((c) => c.name)).toEqual([
      "Kofi Walk-in",
    ]);
    const kofi = clients.find((c) => c.name === "Kofi Walk-in");
    if (!kofi) throw new Error("missing client");
    await saveClient(owner.db, businessId, {
      id: kofi.id,
      name: "Kofi Mensah",
      phone: kofi.phone,
      notes: "Likes a low fade",
    });
    expect((await listClients(owner.db, businessId, { search: "mensah" }))[0]).toMatchObject({
      notes: "Likes a low fade",
    });
    expect((await listClientAppointments(owner.db, businessId, kofi.id)).length).toBeGreaterThan(0);
    expect(await listClients(outsider.db, businessId)).toEqual([]);
  });

  it("concurrency: 10 walk-ins for the same person and time → exactly one", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        addManualAppointment(
          owner.db,
          businessId,
          walkIn({ startsAt: at("15:00"), client: { name: `Racer ${i}`, phone: null } }),
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const r of results) if (r.status === "rejected") expect(r.reason).toMatchObject({ code: "CONFLICT" });
  });
});
