import "server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "@/server/db/client";
import { AppError } from "@/lib/errors";
import { IMAGE_LIMITS } from "@/lib/images";
import { toAppError } from "./errors";

const BUCKET = "public-media";

type ImageKind = "webp" | "jpeg";

/** Sniffs the real format from magic bytes; the browser-provided MIME type is not trusted. */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  return null;
}

async function readImage(file: File, maxBytes: number): Promise<{ bytes: Uint8Array; kind: ImageKind }> {
  if (file.size === 0) throw new AppError("VALIDATION", "Choose a photo to upload.");
  if (file.size > maxBytes) throw new AppError("VALIDATION", "That photo is too large. Please try another one.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind) throw new AppError("VALIDATION", "Use a JPEG or WebP photo.");
  return { bytes, kind };
}

async function put(db: Db, path: string, image: { bytes: Uint8Array; kind: ImageKind }): Promise<void> {
  const { error } = await db.storage.from(BUCKET).upload(path, image.bytes, {
    contentType: `image/${image.kind}`,
    cacheControl: "31536000", // paths are unique per upload, so files never change
    upsert: false,
  });
  if (error) {
    console.error("[storage] upload failed", error.message);
    throw new AppError("FORBIDDEN", "Could not upload the photo. Check you manage this business.");
  }
}

async function removeQuietly(db: Db, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await db.storage.from(BUCKET).remove(paths);
  if (error) console.error("[storage] cleanup failed", paths, error.message); // orphan sweep job cleans up later
}

const ext = (kind: ImageKind) => (kind === "webp" ? "webp" : "jpg");

export async function setLogo(db: Db, businessId: string, file: File): Promise<string> {
  const image = await readImage(file, IMAGE_LIMITS.smallMaxBytes);
  const path = `businesses/${businessId}/logo/${randomUUID()}-400.${ext(image.kind)}`;

  const current = await db.from("businesses").select("logo_path").eq("id", businessId).maybeSingle();
  if (current.error) throw toAppError(current.error);

  await put(db, path, image);
  const { data, error } = await db.from("businesses").update({ logo_path: path }).eq("id", businessId).select("id");
  if (error || data.length === 0) {
    await removeQuietly(db, [path]);
    throw error ? toAppError(error) : new AppError("FORBIDDEN", "You don't have access to this business.");
  }
  if (current.data?.logo_path) await removeQuietly(db, [current.data.logo_path]);
  return path;
}

export async function removeLogo(db: Db, businessId: string): Promise<void> {
  const current = await db.from("businesses").select("logo_path").eq("id", businessId).maybeSingle();
  if (current.error) throw toAppError(current.error);
  const { data, error } = await db.from("businesses").update({ logo_path: null }).eq("id", businessId).select("id");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("FORBIDDEN", "You don't have access to this business.");
  if (current.data?.logo_path) await removeQuietly(db, [current.data.logo_path]);
}

export async function addPortfolioPhoto(
  db: Db,
  businessId: string,
  input: { small: File; large: File; width: number; height: number },
): Promise<void> {
  const small = await readImage(input.small, IMAGE_LIMITS.smallMaxBytes);
  const large = await readImage(input.large, IMAGE_LIMITS.largeMaxBytes);
  const width = Math.round(input.width);
  const height = Math.round(input.height);
  if (!(width >= 1 && width <= 4000 && height >= 1 && height <= 4000)) {
    throw new AppError("VALIDATION", "That photo has unusual dimensions. Please try another one.");
  }

  const id = randomUUID();
  const pathSmall = `businesses/${businessId}/photos/${id}-400.${ext(small.kind)}`;
  const pathLarge = `businesses/${businessId}/photos/${id}-1200.${ext(large.kind)}`;

  await put(db, pathSmall, small);
  try {
    await put(db, pathLarge, large);
  } catch (error) {
    await removeQuietly(db, [pathSmall]);
    throw error;
  }

  const count = await db
    .from("business_photos")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  const sortOrder = count.count ?? 0;
  const { error } = await db.from("business_photos").insert({
    business_id: businessId,
    path_small: pathSmall,
    path_large: pathLarge,
    width,
    height,
    sort_order: sortOrder,
  });
  if (error) {
    await removeQuietly(db, [pathSmall, pathLarge]);
    if (error.code === "23514") {
      throw new AppError(
        "LIMIT_REACHED",
        `You can add up to ${IMAGE_LIMITS.maxPortfolioPhotos} photos. Remove one first.`,
      );
    }
    throw toAppError(error);
  }
}

export async function deletePortfolioPhoto(db: Db, businessId: string, photoId: string): Promise<void> {
  const { data, error } = await db
    .from("business_photos")
    .delete()
    .eq("business_id", businessId)
    .eq("id", photoId)
    .select("path_small, path_large");
  if (error) throw toAppError(error);
  if (data.length === 0) throw new AppError("NOT_FOUND", "That photo no longer exists.");
  await removeQuietly(
    db,
    data.flatMap((p) => [p.path_small, p.path_large]),
  );
}

/** Tags a portfolio photo with one of the business's services (or clears it). The FK keeps it in-business. */
export async function setPhotoService(
  db: Db,
  businessId: string,
  photoId: string,
  serviceId: string | null,
): Promise<void> {
  const { data, error } = await db
    .from("business_photos")
    .update({ service_id: serviceId })
    .eq("business_id", businessId)
    .eq("id", photoId)
    .select("id");
  if (error) {
    if (error.code === "23503") throw new AppError("VALIDATION", "Choose one of your services.");
    throw toAppError(error);
  }
  if (data.length === 0) throw new AppError("NOT_FOUND", "That photo no longer exists.");
}
