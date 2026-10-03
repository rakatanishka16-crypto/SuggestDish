-- Public restaurant menu evidence does not establish a verified ownership claim.
CREATE TABLE IF NOT EXISTS public."SourceStarDish" (
 "restaurantId" INTEGER PRIMARY KEY REFERENCES public."Restaurant"(id),
 "dishId" INTEGER NOT NULL REFERENCES public."Dish"(id),
 "sourceUrl" TEXT NOT NULL,
 "evidenceKind" TEXT NOT NULL CHECK("evidenceKind" IN ('signature','bestseller')),
 "evidenceNotes" TEXT NOT NULL,
 "sourceCheckedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "expiresAt" TIMESTAMPTZ NOT NULL DEFAULT (NOW()+INTERVAL '60 days'),
 CHECK("expiresAt">"sourceCheckedAt")
);
