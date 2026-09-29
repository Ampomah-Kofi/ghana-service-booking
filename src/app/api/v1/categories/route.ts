import type { z } from "zod";
import type { categoriesResponse } from "@/schemas/api-v1";
import { apiClient, apiError, isPersonalised, json } from "@/server/api/http";
import { listActiveCategories } from "@/server/catalog/categories";

/** GET /api/v1/categories: active categories in display order. */
export async function GET(request: Request) {
  try {
    const categories = await listActiveCategories(apiClient(request));
    const body: z.infer<typeof categoriesResponse> = { data: categories };
    return json(body, { cacheSeconds: 300, personalised: isPersonalised(request) });
  } catch (error) {
    return apiError(error);
  }
}
