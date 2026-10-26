-- Two owner-submitted sponsored dishes per paid business. Existing menu records are untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public."PaidDishPromotion" (
 id UUID PRIMARY KEY,
 "submissionId" UUID NOT NULL REFERENCES public."BusinessSubmission"(id),
 "paymentId" UUID NOT NULL REFERENCES public."BusinessPlanPayment"(id),
 slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 2),
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
 price DOUBLE PRECISION NOT NULL CHECK(price>0 AND price<=100000),
 "isVeg" BOOLEAN NOT NULL,
 "menuUrl" TEXT NOT NULL CHECK(length("menuUrl") BETWEEN 1 AND 2000 AND "menuUrl" LIKE 'https://%'),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE("submissionId",slot)
);
ALTER TABLE public."PaidDishPromotion" ENABLE ROW LEVEL SECURITY;
COMMIT;
BEGIN;
ALTER TABLE public."PaidDishPromotion" ADD COLUMN IF NOT EXISTS "businessName" TEXT,
 ADD COLUMN IF NOT EXISTS "businessInfo" TEXT,
 ADD COLUMN IF NOT EXISTS photo BYTEA CHECK(photo IS NULL OR octet_length(photo)<=245760),
 ADD COLUMN IF NOT EXISTS "photoMime" TEXT CHECK("photoMime" IS NULL OR "photoMime" IN ('image/jpeg','image/png'));
COMMIT;
