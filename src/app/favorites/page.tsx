import type { Metadata } from "next";
import { ResultList } from "@/components/marketplace/result-list";
import { EmptyState } from "@/components/ui/empty-state";
import { HeartIcon, UserIcon } from "@/components/ui/icons";
import { LargeTitle } from "@/components/ui/large-title";
import { publicEnv } from "@/lib/public-env";
import { getCurrentUser } from "@/server/auth/session";
import { listCurrencies } from "@/server/catalog/currencies";
import { createUserClient } from "@/server/db/supabase-server";
import { listMyFavorites } from "@/server/favorites/favorites";
import { nextAvailableToday } from "@/server/scheduling/next-available";

export const metadata: Metadata = { title: "Favourites" };

/** Saved businesses (Phase 7): private to the customer, newest first, with today's next free time. */
export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <LargeTitle title="Favourites" />
        <EmptyState
          icon={UserIcon}
          title="Sign in to see your favourites"
          body="Save your barber, braider or spa with the ♥ and find them here in one tap."
          action={{ href: "/sign-in?next=/favorites", label: "Sign in", primary: true }}
        />
      </>
    );
  }
  const db = await createUserClient();
  const [cards, currencies] = await Promise.all([listMyFavorites(db), listCurrencies(db)]);
  const next = await nextAvailableToday(
    db,
    cards.map((c) => c.id),
  );

  return (
    <>
      <LargeTitle title="Favourites" />
      {cards.length === 0 ? (
        <EmptyState
          icon={HeartIcon}
          title="No favourites yet"
          body="Tap the ♥ on any place you like and it will wait for you here."
          action={{ href: "/", label: "Explore", primary: true }}
        />
      ) : (
        <ResultList
          cards={cards}
          supabaseUrl={publicEnv().NEXT_PUBLIC_SUPABASE_URL}
          currencies={currencies}
          next={next}
          favorites={new Set(cards.map((c) => c.id))}
        />
      )}
    </>
  );
}
