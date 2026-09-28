"use client";

import { XIcon } from "@/components/ui/icons";

export type ViewerPhoto = { id: string; small: string; large: string };

const VIEWER_ID = "photo-viewer";

/** Scrolls the viewer to photo `index` once it's open (JavaScript nicety; it opens on the first photo without). */
function showAt(index: number) {
  requestAnimationFrame(() => {
    document.getElementById(`${VIEWER_ID}-${index}`)?.scrollIntoView({ inline: "start", block: "nearest" });
  });
}

/**
 * "Our work" grid plus a full-screen, swipeable photo viewer (ADR-0012). The viewer is an HTML popover,
 * so it opens without JavaScript; swiping is CSS scroll-snap. Each photo says "3 of 8".
 */
export function PhotoGallery({ photos, businessName }: { photos: ViewerPhoto[]; businessName: string }) {
  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5">
        {photos.map((photo, i) => (
          <li key={photo.id}>
            <button
              type="button"
              popoverTarget={VIEWER_ID}
              onClick={() => showAt(i)}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
              className="pressable block w-full overflow-hidden rounded-inner"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized 400px rendition */}
              <img
                src={photo.small}
                alt=""
                width={400}
                height={400}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      <div id={VIEWER_ID} popover="auto" role="dialog" aria-label={`Photos by ${businessName}`} className="viewer">
        <ul className="rail flex h-full overflow-x-auto">
          {photos.map((photo, i) => (
            <li
              key={photo.id}
              id={`${VIEWER_ID}-${i}`}
              className="relative flex h-full w-full shrink-0 items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized 1600px rendition, loaded on demand */}
              <img
                src={photo.large}
                alt={`Work by ${businessName}, photo ${i + 1} of ${photos.length}`}
                loading="lazy"
                className="max-h-full max-w-full object-contain"
              />
              <p className="absolute inset-x-0 bottom-0 pb-safe-sm text-center text-small font-semibold text-white/85 tabular-nums">
                {i + 1} of {photos.length}
              </p>
            </li>
          ))}
        </ul>
        <div className="absolute top-0 right-0 p-3 pt-safe-sm">
          <button
            type="button"
            popoverTarget={VIEWER_ID}
            popoverTargetAction="hide"
            aria-label="Close photos"
            className="pressable flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md"
          >
            <XIcon />
          </button>
        </div>
      </div>
    </>
  );
}

/** A glass "8 photos" chip over the cover that opens the same viewer. */
export function PhotoCountChip({ count }: { count: number }) {
  return (
    <button
      type="button"
      popoverTarget={VIEWER_ID}
      onClick={() => showAt(0)}
      className="glass pressable absolute right-3 bottom-9 rounded-full px-3 py-1 text-caption font-semibold text-ink"
    >
      {count} photos
    </button>
  );
}
