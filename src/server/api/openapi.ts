import "server-only";
import { z } from "zod";
import { apiError, businessProfile, categoriesResponse, searchQuery, searchResponse } from "@/schemas/api-v1";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { target: "openapi-3.0", io: "output", unrepresentable: "any" });

function queryParameters() {
  const shape = searchQuery.shape;
  return Object.entries(shape).map(([name, field]) => ({
    name,
    in: "query",
    required: false,
    schema: z.toJSONSchema(field as z.ZodType, { target: "openapi-3.0", io: "input", unrepresentable: "any" }),
  }));
}

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
    },
  };
}
