/**
 * Browser-only: shrinks a photo before upload (docs/architecture.md §11).
 * Re-encoding through a canvas also drops EXIF data such as GPS coordinates.
 * Prefers WebP; falls back to JPEG where the browser can't encode WebP (older Safari).
 */
export type ResizedImage = { blob: Blob; width: number; height: number; type: "image/webp" | "image/jpeg" };

async function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function resizeImage(file: File, maxWidth: number, maxBytes: number): Promise<ResizedImage> {
  // imageOrientation applies EXIF rotation so portrait phone photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, maxWidth / bitmap.width);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.82, 0.72, 0.6, 0.5]) {
      let blob = await encode(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", quality);
      if (blob && blob.size <= maxBytes) {
        return { blob, width, height, type: blob.type === "image/webp" ? "image/webp" : "image/jpeg" };
      }
    }
    throw new Error("image too large after compression");
  } finally {
    bitmap.close();
  }
}
