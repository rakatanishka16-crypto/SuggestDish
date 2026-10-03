BEGIN;
CREATE TABLE IF NOT EXISTS public."BusinessSubmission" (
 id UUID PRIMARY KEY,
 "duplicateKey" TEXT NOT NULL UNIQUE,
 "businessName" TEXT NOT NULL,
 category TEXT NOT NULL,
 city TEXT NOT NULL,
 address TEXT NOT NULL,
 "contactName" TEXT NOT NULL,
 email TEXT NOT NULL,
 phone TEXT NOT NULL,
 "profileUrl" TEXT NOT NULL,
 "menuUrl" TEXT,
 "dishName" TEXT NOT NULL,
 "dishPrice" DOUBLE PRECISION NOT NULL CHECK ("dishPrice">0 AND "dishPrice"<=100000),
 "isVeg" BOOLEAN NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','needs_information')),
 "verificationNotes" TEXT,
 "verifiedSourceUrl" TEXT,
 "reviewedAt" TIMESTAMPTZ,
 "restaurantId" INTEGER REFERENCES public."Restaurant"(id),
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_submission_review ON public."BusinessSubmission" (status,"createdAt");
COMMIT;
