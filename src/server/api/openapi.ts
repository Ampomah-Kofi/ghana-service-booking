import "server-only";
import { z } from "zod";
import {
  apiError,
  appointmentResponse,
  availabilityQuery,
  availabilityResponse,
  businessAppointmentsQuery,
  businessAppointmentsResponse,
  businessProfile,
  cancelAppointmentBody,
  categoriesResponse,
  createAppointmentBody,
  createManualAppointmentBody,
  myAppointmentsResponse,
  rescheduleAppointmentBody,
  searchQuery,
  searchResponse,
  statusChangeBody,
  businessReviewsResponse,
  favoriteState,
  favoritesResponse,
  myReviewsResponse,
  replyBody,
  reportBody,
  reviewBody,
  reviewResponse,
  reviewsQuery,
} from "@/schemas/api-v1";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { target: "openapi-3.0", io: "output", unrepresentable: "any" });

function queryParameters(query: z.ZodObject = searchQuery) {
  const shape = query.shape;
  return Object.entries(shape).map(([name, field]) => ({
    name,
    in: "query",
    required: false,
    schema: z.toJSONSchema(field as z.ZodType, { target: "openapi-3.0", io: "input", unrepresentable: "any" }),
  }));
}

const body = (s: z.ZodType) => z.toJSONSchema(s, { target: "openapi-3.0", io: "input", unrepresentable: "any" });
const json = (name: string) => ({ "application/json": { schema: { $ref: `#/components/schemas/${name}` } } });

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

/** OpenAPI 3.0 document generated from the same Zod schemas the handlers use. */
export function buildOpenApiDocument(serverUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "Marketplace API",
      version: "1.0.0",
      description:
        "Public API for web and future mobile apps. Money is { amount_minor, currency } in minor units (pesewas for GHS). Times are ISO-8601 UTC. Authenticate with `Authorization: Bearer <Supabase access token>`; public endpoints work without it.",
    },
    servers: [{ url: `${serverUrl.replace(/\/$/, "")}/api/v1` }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas: {
        Error: schema(apiError),
        Categories: schema(categoriesResponse),
        SearchResults: schema(searchResponse),
        BusinessProfile: schema(businessProfile),
        Availability: schema(availabilityResponse),
        Appointment: schema(appointmentResponse),
        MyAppointments: schema(myAppointmentsResponse),
        BusinessAppointments: schema(businessAppointmentsResponse),
        Favorites: schema(favoritesResponse),
        FavoriteState: schema(favoriteState),
        Review: schema(reviewResponse),
        BusinessReviews: schema(businessReviewsResponse),
        MyReviews: schema(myReviewsResponse),
      },
    },
    paths: {
      "/categories": {
        get: {
          summary: "List active categories",
          responses: {
            "200": {
              description: "Categories",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Categories" } } },
            },
          },
        },
      },
      "/search": {
        get: {
          summary: "Search businesses",
          description:
            'Understands "what in where" (e.g. "Barber in East Legon") and "near me" (pass lat/lng). Widens the search with a `notice` when a place has no matches.',
          parameters: queryParameters(),
          responses: {
            "200": {
              description: "Results",
              content: { "application/json": { schema: { $ref: "#/components/schemas/SearchResults" } } },
            },
            "422": errorResponse("Invalid parameters"),
          },
        },
      },
      "/businesses/{slug}": {
        get: {
          summary: "Public business profile",
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": {
              description: "Profile",
              content: { "application/json": { schema: { $ref: "#/components/schemas/BusinessProfile" } } },
            },
            "404": errorResponse("Not found or not published"),
          },
        },
      },
      "/businesses/{slug}/availability": {
        get: {
          summary: "Open start times for a service",
          description:
            "Computed in the business's timezone from hours, staff hours, bookings, buffers, time off, minimum notice and the advance window. `staff_id=any` merges everyone who does the service. Booking re-checks everything in the database.",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            ...queryParameters(availabilityQuery).map((p) => ({ ...p, required: p.name === "service_id" })),
          ],
          responses: {
            "200": { description: "Days and times", content: json("Availability") },
            "404": errorResponse("Business or service not found"),
            "422": errorResponse("Invalid parameters"),
          },
        },
      },
      "/appointments": {
        post: {
          summary: "Book an appointment",
          security: [{ bearer: [] }],
          parameters: [
            {
              name: "Idempotency-Key",
              in: "header",
              required: true,
              description:
                "Unique per booking attempt (e.g. a UUID). Retrying with the same key returns the same booking.",
              schema: { type: "string", minLength: 8, maxLength: 100 },
            },
          ],
          requestBody: { required: true, content: { "application/json": { schema: body(createAppointmentBody) } } },
          responses: {
            "201": { description: "Booked", content: json("Appointment") },
            "401": errorResponse("Not signed in"),
            "409": errorResponse("That time was just taken"),
            "422": errorResponse("Invalid input, too soon, or too far ahead"),
            "429": errorResponse("Too many bookings in a short time"),
          },
        },
      },
      "/me/appointments": {
        get: {
          summary: "Your bookings",
          security: [{ bearer: [] }],
          responses: {
            "200": { description: "Upcoming and past bookings", content: json("MyAppointments") },
            "401": errorResponse("Not signed in"),
          },
        },
      },
      "/appointments/{id}/cancel": {
        post: {
          summary: "Cancel your booking",
          description: "Allowed until the business's cancellation window (see `can_change`).",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: false, content: { "application/json": { schema: body(cancelAppointmentBody) } } },
          responses: {
            "200": { description: "Cancelled", content: json("Appointment") },
            "401": errorResponse("Not signed in"),
            "404": errorResponse("Not your booking"),
            "409": errorResponse("Too late to change online, or already cancelled"),
          },
        },
      },
      "/appointments/{id}/reschedule": {
        post: {
          summary: "Move your booking",
          description: "Atomic: if the new time is taken, the original booking is unchanged. Returns the new booking.",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: body(rescheduleAppointmentBody) } } },
          responses: {
            "200": { description: "Moved", content: json("Appointment") },
            "401": errorResponse("Not signed in"),
            "404": errorResponse("Not your booking"),
            "409": errorResponse("New time taken, or too late to change online"),
          },
        },
      },
      "/businesses/{slug}/appointments": {
        get: {
          summary: "A business's appointments (members)",
          description: "Owners and managers see everyone's appointments; staff see only their own.",
          security: [{ bearer: [] }],
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            ...queryParameters(businessAppointmentsQuery).map((p) => ({ ...p, required: p.name === "from" })),
          ],
          responses: {
            "200": { description: "Appointments, soonest first", content: json("BusinessAppointments") },
            "401": errorResponse("Not signed in"),
            "404": errorResponse("Not a member of this business"),
          },
        },
        post: {
          summary: "Add a phone booking or a walk-in (members)",
          description:
            "Staff can add only for themselves. Walk-ins start now as `arrived`. `allow_outside_hours` skips the working-hours check; overlaps are always refused.",
          security: [{ bearer: [] }],
          parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: body(createManualAppointmentBody) } },
          },
          responses: {
            "201": { description: "Added", content: json("Appointment") },
            "403": errorResponse("Not allowed for this team member"),
            "409": errorResponse("Overlaps another booking, or outside hours without the override"),
            "422": errorResponse("Invalid input"),
          },
        },
      },
      "/me/favorites": {
        get: {
          summary: "Your saved businesses",
          description: "Private to you; businesses can't see who saved them. Unpublished businesses drop out.",
          security: [{ bearer: [] }],
          responses: {
            "200": { description: "Result cards, newest saved first", content: json("Favorites") },
            "401": errorResponse("Not signed in"),
          },
        },
      },
      "/me/favorites/{businessId}": {
        put: {
          summary: "Save a business (idempotent)",
          security: [{ bearer: [] }],
          parameters: [{ name: "businessId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Saved", content: json("FavoriteState") },
            "401": errorResponse("Not signed in"),
            "404": errorResponse("Unknown or unpublished business"),
          },
        },
        delete: {
          summary: "Unsave a business (idempotent)",
          security: [{ bearer: [] }],
          parameters: [{ name: "businessId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Removed", content: json("FavoriteState") },
            "401": errorResponse("Not signed in"),
          },
        },
      },
      "/businesses/{slug}/reviews": {
        get: {
          summary: "Published reviews of a business",
          description: "Only from customers with a completed booking. `meta` has the rating summary.",
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            ...queryParameters(reviewsQuery),
          ],
          responses: {
            "200": { description: "Reviews, newest first", content: json("BusinessReviews") },
            "404": errorResponse("Not found or not published"),
          },
        },
      },
      "/me/reviews": {
        get: {
          summary: "Your reviews (any status)",
          security: [{ bearer: [] }],
          responses: {
            "200": { description: "Reviews", content: json("MyReviews") },
            "401": errorResponse("Not signed in"),
          },
        },
      },
      "/appointments/{id}/review": {
        post: {
          summary: "Review your completed visit",
          description: "One review per appointment, only by its customer, only once it is `completed`.",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: body(reviewBody) } } },
          responses: {
            "201": { description: "Posted", content: json("Review") },
            "401": errorResponse("Not signed in"),
            "404": errorResponse("Not your booking"),
            "409": errorResponse("Already reviewed"),
            "422": errorResponse("Not completed yet, or invalid input"),
          },
        },
      },
      "/reviews/{id}": {
        patch: {
          summary: "Edit your review",
          description: "Allowed for 14 days after posting, while it is published (see `editable_until`).",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: body(reviewBody) } } },
          responses: {
            "200": { description: "Updated", content: json("Review") },
            "404": errorResponse("Not your review"),
            "422": errorResponse("Edit window over, hidden, or invalid input"),
          },
        },
      },
      "/reviews/{id}/reply": {
        put: {
          summary: "Post or replace the business's reply (owners and managers)",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: body(replyBody) } } },
          responses: {
            "200": { description: "Replied", content: json("Review") },
            "403": errorResponse("Staff can't reply for the business"),
            "404": errorResponse("Not a review of your business"),
          },
        },
      },
      "/reviews/{id}/report": {
        post: {
          summary: "Report a review to moderators",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: body(reportBody) } } },
          responses: {
            "202": { description: "Reported" },
            "404": errorResponse("Review not found"),
            "409": errorResponse("Already reported by you"),
            "422": errorResponse("Your own review, or invalid input"),
          },
        },
      },
      "/appointments/{id}/status": {
        post: {
          summary: "Change an appointment's status (business side)",
          description:
            "pending → confirmed/arrived/cancelled/no_show; confirmed → arrived/completed/cancelled/no_show; arrived → completed/confirmed/cancelled; completed → arrived and no_show → confirmed within 7 days (undo). Arrived from 1 hour before; completed/no_show only once started. `final_price_minor` only with completed.",
          security: [{ bearer: [] }],
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: { required: true, content: { "application/json": { schema: body(statusChangeBody) } } },
          responses: {
            "200": { description: "Updated", content: json("Appointment") },
            "404": errorResponse("Not found or not yours"),
            "409": errorResponse("That change isn't allowed now"),
          },
        },
      },
    },
  };
}
