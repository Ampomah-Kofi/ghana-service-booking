"use client";

import { useActionState, useState, useTransition, type ChangeEvent } from "react";
import { FormMessage } from "@/components/ui/field";
import { IMAGE_LIMITS } from "@/lib/images";
import { resizeImage } from "@/lib/image-resize";
import type { FormState } from "@/server/actions";
import { addPhotoAction, uploadLogoAction } from "../../actions";

function extension(type: string) {
  return type === "image/webp" ? "webp" : "jpg";
}

/** Picks a photo, resizes it in the browser, then submits the small file(s) to the Server Action. */
function usePhotoPicker(onReady: (file: File) => Promise<FormData | null>, action: (formData: FormData) => void) {
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  async function handle(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo (JPEG, PNG, HEIC or WebP).");
    if (file.size > IMAGE_LIMITS.maxInputBytes) return setError("That photo is over 25 MB. Choose a smaller one.");
    try {
      const formData = await onReady(file);
      if (formData) startTransition(() => action(formData));
    } catch {
      setError("We couldn't read that photo. Try a different one.");
    } finally {
      input.value = ""; // allow picking the same file again
    }
  }

  return { busy, error, handle };
}

export function LogoUpload({ businessId, hasLogo }: { businessId: string; hasLogo: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadLogoAction, {});
  const picker = usePhotoPicker(async (file) => {
    const small = await resizeImage(file, IMAGE_LIMITS.smallWidth, IMAGE_LIMITS.smallMaxBytes);
    const formData = new FormData();
    formData.set("businessId", businessId);
    formData.set("logo", new File([small.blob], `logo.${extension(small.type)}`, { type: small.type }));
    return formData;
  }, action);
  const working = pending || picker.busy;

  return (
    <div>
      <FormMessage tone="error" message={picker.error ?? state.message} />
      <FormMessage tone="notice" message={state.notice} />
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-control bg-fill px-4 text-body font-medium text-primary">
        {working ? "Uploading…" : hasLogo ? "Change logo" : "Upload logo"}
        <input type="file" accept="image/*" className="sr-only" disabled={working} onChange={picker.handle} />
      </label>
    </div>
  );
}

export function PhotoUpload({ businessId, count }: { businessId: string; count: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addPhotoAction, {});
  const picker = usePhotoPicker(async (file) => {
    const [small, large] = await Promise.all([
      resizeImage(file, IMAGE_LIMITS.smallWidth, IMAGE_LIMITS.smallMaxBytes),
      resizeImage(file, IMAGE_LIMITS.largeWidth, IMAGE_LIMITS.largeMaxBytes),
    ]);
    const formData = new FormData();
    formData.set("businessId", businessId);
    formData.set("small", new File([small.blob], `small.${extension(small.type)}`, { type: small.type }));
    formData.set("large", new File([large.blob], `large.${extension(large.type)}`, { type: large.type }));
    formData.set("width", String(large.width));
    formData.set("height", String(large.height));
    return formData;
  }, action);
  const working = pending || picker.busy;
  const full = count >= IMAGE_LIMITS.maxPortfolioPhotos;

  return (
    <div>
      <FormMessage tone="error" message={picker.error ?? state.message} />
      <label
        className={`flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-control border-2 border-dashed border-border text-center text-small font-medium text-primary ${
          full ? "pointer-events-none opacity-40" : ""
        }`}
      >
        <span aria-hidden="true" className="text-display leading-none">
          +
        </span>
        <span>{working ? "Uploading…" : full ? "Photo limit reached" : "Add photo"}</span>
        <input type="file" accept="image/*" className="sr-only" disabled={working || full} onChange={picker.handle} />
      </label>
    </div>
  );
}
