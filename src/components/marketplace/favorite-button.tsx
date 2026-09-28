"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useOptimistic, startTransition } from "react";
import { toggleFavoriteAction, type FavoriteState } from "@/app/favorites/actions";
import { HeartIcon } from "@/components/ui/icons";

/**
 * Heart to save a business (Phase 7). Optimistic, pops when saved, a plain form without JavaScript.
 * `saved === null` means signed out: the heart goes to sign-in and comes back here.
 */
export function FavoriteButton({
  businessId,
  businessName,
  saved,
  className = "",
}: {
  businessId: string;
  businessName: string;
  saved: boolean | null;
  className?: string;
}) {
  const pathname = usePathname();
  const [state, formAction] = useActionState<FavoriteState, FormData>(toggleFavoriteAction, { saved: Boolean(saved) });
  const [optimistic, setOptimistic] = useOptimistic(state.saved);

  const base = `pressable flex size-10 items-center justify-center rounded-full ${className}`;
  if (saved === null) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(pathname)}`}
        aria-label={`Sign in to save ${businessName}`}
        className={base}
      >
        <HeartIcon className="size-5" />
      </Link>
    );
  }
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => {
          setOptimistic(data.get("save") === "1");
          formAction(data);
        });
      }}
    >
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="save" value={optimistic ? "0" : "1"} />
      <button
        type="submit"
        aria-pressed={optimistic}
        aria-label={optimistic ? `Remove ${businessName} from favourites` : `Save ${businessName} to favourites`}
        title={state.error}
        className={base}
      >
        <HeartIcon filled={optimistic} className={`size-5 ${optimistic ? "pop text-danger" : ""}`} />
      </button>
    </form>
  );
}
