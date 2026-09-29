import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accountDeletionBlocker, deleteMyAccount, updateMyName } from "@/server/account/account";
import { createService } from "@/server/businesses/catalog";
import { createBusiness } from "@/server/businesses/onboarding";
import { listStaff } from "@/server/businesses/team";
import { listActiveCategories } from "@/server/catalog/categories";
import { addFavorite, favoriteIdsAmong, listMyFavorites, removeFavorite } from "@/server/favorites/favorites";
import {
  listBusinessReviews,
  listMyReviews,
  listReviewsForBusiness,
  myReviewFor,
  ratingSummary,
  replyToReview,
  reportReview,
  submitReview,
  updateReview,
} from "@/server/reviews/reviews";
import { adminClient, anonClient, cleanup, signedInUser, type SignedInUser } from "./support";

let owner: SignedInUser;
let customer: SignedInUser;
let leaver: SignedInUser;
let stranger: SignedInUser;
const cleanupIds: string[] = [];
let businessId: string;
let serviceId: string;
let staffId: string;

/** A completed visit yesterday (set up with the admin client: completing needs the visit to have happened). */
async function completedVisit(userId: string, hour: number): Promise<string> {
  const start = new Date(Date.now() - 86_400_000);
  start.setUTCHours(hour, 0, 0, 0);
  const { data, error } = await adminClient()
    .from("appointments")
    .insert({
      business_id: businessId,
      service_id: serviceId,
      staff_id: staffId,
      source: "online",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
      service_name: "Silk press",
      price_minor: 12000,
      price_type: "fixed",
      currency_code: "GHS",
      customer_name: "Booked Name",
      customer_phone_e164: "+233244000111",
      customer_user_id: userId,
      status: "completed",
      // Recomputed by the appointments_occupied trigger; required by the generated types.
      occupied: `[${start.toISOString()},${new Date(start.getTime() + 30 * 60_000).toISOString()})`,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  owner = await signedInUser("Review Owner");
  customer = await signedInUser("Abena Mensah");
  leaver = await signedInUser("Leaving Customer");
  stranger = await signedInUser("Kojo Stranger");
  cleanupIds.push(owner.id, customer.id, stranger.id, leaver.id);
  const [hair] = (await listActiveCategories(owner.db)).filter((c) => c.slug === "hair-salons");
  businessId = (await createBusiness(owner.db, { kind: "solo", name: "Review Test Salon", categoryId: hair.id }, "GH"))
    .id;
  [{ id: staffId }] = await listStaff(owner.db, businessId, { withInvites: false });
  serviceId = await createService(
    owner.db,
    { id: businessId, currencyCode: "GHS" },
    {
      name: "Silk press",
      description: null,
      price: 12000,
      priceType: "fixed",
      durationMinutes: 30,
      isActive: true,
      staffIds: [staffId],
    },
  );
  // Publishing needs a full profile; the test only needs the page to be public.
  await adminClient()
    .from("businesses")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", businessId);
}, 60_000);

afterAll(async () => {
  await cleanup(cleanupIds);
});

describe("favourites", () => {
  it("saves (idempotently), lists as cards, and removes", async () => {
    await addFavorite(customer.db, customer.id, businessId);
    await addFavorite(customer.db, customer.id, businessId);
    expect((await listMyFavorites(customer.db)).map((c) => c.name)).toEqual(["Review Test Salon"]);
    expect(
      await favoriteIdsAmong(customer.db, customer.id, [businessId, "b0000000-0000-4000-8000-000000000001"]),
    ).toEqual(new Set([businessId]));
    expect(await listMyFavorites(stranger.db)).toEqual([]);
    await removeFavorite(customer.db, customer.id, businessId);
    expect(await listMyFavorites(customer.db)).toEqual([]);
  });

  it("refuses drafts and other people's lists", async () => {
    // Osu Glow Spa is a draft in the seed.
    await expect(addFavorite(customer.db, customer.id, "b0000000-0000-4000-8000-000000000003")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(addFavorite(stranger.db, customer.id, businessId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("reviews", () => {
  let visit: string;
  let reviewId: string;

  it("lets the customer review a completed visit once", async () => {
    visit = await completedVisit(customer.id, 9);
    await expect(submitReview(stranger.db, visit, { rating: 5, body: "Fake" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    reviewId = await submitReview(customer.db, visit, { rating: 5, body: "Silky and neat." });
    await expect(submitReview(customer.db, visit, { rating: 4, body: null })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You have already reviewed this visit.",
    });
  });

  it("shows it publicly with a short author name, and updates the rating", async () => {
    const [shown] = await listBusinessReviews(anonClient(), businessId);
    expect(shown).toMatchObject({
      id: reviewId,
      authorName: "Abena M.",
      rating: 5,
      serviceName: "Silk press",
      mine: false,
    });
    expect(await ratingSummary(anonClient(), businessId)).toEqual({
      average: 5,
      count: 1,
      distribution: [0, 0, 0, 0, 1],
    });
    const { data } = await anonClient()
      .from("businesses")
      .select("rating_avg, rating_count")
      .eq("id", businessId)
      .single();
    expect(data).toEqual({ rating_avg: 5, rating_count: 1 });
  });

  it("lets the author edit for 14 days", async () => {
    const mine = await myReviewFor(customer.db, customer.id, visit);
    expect(mine?.editableUntil).toBeTruthy();
    await updateReview(customer.db, reviewId, { rating: 4, body: "Silky, a bit late." });
    await expect(updateReview(stranger.db, reviewId, { rating: 1, body: null })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await listMyReviews(customer.db, customer.id)).map((r) => [r.rating, r.businessName])).toEqual([
      [4, "Review Test Salon"],
    ]);
  });

  it("lets only the business reply, and anyone else report once", async () => {
    await expect(replyToReview(stranger.db, reviewId, "Not my business")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await replyToReview(owner.db, reviewId, "Thank you, Abena!");
    const [forOwner] = await listReviewsForBusiness(owner.db, businessId);
    expect(forOwner.reply?.body).toBe("Thank you, Abena!");
    expect(await listReviewsForBusiness(owner.db, businessId, { filter: "unanswered" })).toEqual([]);
    expect(await listReviewsForBusiness(stranger.db, businessId)).toHaveLength(1); // published = public anyway

    await reportReview(stranger.db, reviewId, "not_genuine", "Doubt it");
    await expect(reportReview(stranger.db, reviewId, "spam", null)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(reportReview(customer.db, reviewId, "spam", null)).rejects.toMatchObject({ code: "VALIDATION" });
  });
});

describe("account", () => {
  it("edits the name used on new reviews", async () => {
    await updateMyName(customer.db, customer.id, "Abena Owusu-Mensah");
    const { data } = await customer.db.from("profiles").select("full_name").eq("id", customer.id).single();
    expect(data?.full_name).toBe("Abena Owusu-Mensah");
  });

  it("refuses to delete a business owner; deletes a customer and anonymises", async () => {
    expect(await accountDeletionBlocker(owner.db)).toMatch(/own a business/);
    await expect(deleteMyAccount(owner.db)).rejects.toMatchObject({ code: "VALIDATION" });

    const visit = await completedVisit(leaver.id, 11);
    await submitReview(leaver.db, visit, { rating: 3, body: "Okay." });
    await addFavorite(leaver.db, leaver.id, businessId);
    expect(await accountDeletionBlocker(leaver.db)).toBeNull();
    await deleteMyAccount(leaver.db);

    const admin = adminClient();
    expect((await admin.auth.admin.getUserById(leaver.id)).data.user).toBeNull();
    const { data: review } = await admin
      .from("reviews")
      .select("user_id, author_name")
      .eq("appointment_id", visit)
      .single();
    expect(review).toEqual({ user_id: null, author_name: "Former customer" });
    const { data: appt } = await admin
      .from("appointments")
      .select("customer_user_id, customer_name, customer_phone_e164")
      .eq("id", visit)
      .single();
    expect(appt).toEqual({ customer_user_id: null, customer_name: "Deleted customer", customer_phone_e164: null });
    const { count } = await admin
      .from("favorites")
      .select("*", { count: "exact", head: true })
      .eq("user_id", leaver.id);
    expect(count).toBe(0);
  });
});
