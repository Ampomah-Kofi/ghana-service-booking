import "server-only";
import { z } from "zod";
import {
  apiError,
  appointmentResponse,
  availabilityQuery,
  availabilityResponse,
  businessProfile,
  cancelAppointmentBody,
  categoriesResponse,
  createAppointmentBody,
  myAppointmentsResponse,
  rescheduleAppointmentBody,
  searchQuery,
  searchResponse,
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
    },
  };
}
