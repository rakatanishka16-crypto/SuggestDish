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

-- For use by a trusted reviewer through Neon, after independent source checks.
CREATE OR REPLACE FUNCTION public.approve_business_submission(submission_id UUID, evidence_url TEXT, review_notes TEXT)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE s public."BusinessSubmission"%ROWTYPE; rid INTEGER; did INTEGER;
BEGIN
 SELECT * INTO s FROM public."BusinessSubmission" WHERE id=submission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
 IF s.status='approved' AND s."restaurantId" IS NOT NULL THEN RETURN s."restaurantId"; END IF;
 IF s.status NOT IN ('pending','needs_information') THEN RAISE EXCEPTION 'Submission is not awaiting approval'; END IF;
 IF evidence_url IS NULL OR evidence_url !~ '^https://' OR review_notes IS NULL OR LENGTH(TRIM(review_notes))<20 THEN RAISE EXCEPTION 'Record the verified source and review checks before approval'; END IF;
 PERFORM pg_advisory_xact_lock(67423004);
 SELECT MIN(id) INTO rid FROM public."Restaurant" WHERE LOWER(TRIM(name))=LOWER(TRIM(s."businessName")) AND LOWER(TRIM(city))=LOWER(TRIM(s.city)) AND LOWER(TRIM(address))=LOWER(TRIM(s.address));
 IF rid IS NULL THEN
  INSERT INTO public."Restaurant" (name,address,city,"updatedAt") VALUES (s."businessName",s.address,s.city,NOW()) RETURNING id INTO rid;
 END IF;
 SELECT MIN(id) INTO did FROM public."Dish" WHERE "restaurantId"=rid AND LOWER(TRIM(name))=LOWER(TRIM(s."dishName"));
 IF did IS NULL THEN
  INSERT INTO public."Dish" (name,price,"isVeg","restaurantId","updatedAt") VALUES (s."dishName",s."dishPrice",s."isVeg",rid,NOW()) RETURNING id INTO did;
 ELSIF NOT EXISTS (SELECT 1 FROM public."Dish" WHERE id=did AND price=s."dishPrice" AND "isVeg"=s."isVeg") THEN
  RAISE EXCEPTION 'Existing dish price or diet conflicts; resolve after source review';
 END IF;
 INSERT INTO public."DishSignal" ("dishId",source) SELECT did,evidence_url WHERE NOT EXISTS (SELECT 1 FROM public."DishSignal" WHERE "dishId"=did AND source=evidence_url);
 UPDATE public."BusinessSubmission" SET status='approved',"restaurantId"=rid,"verifiedSourceUrl"=evidence_url,"verificationNotes"=review_notes,"reviewedAt"=NOW() WHERE id=submission_id;
 RETURN rid;
END;
$$;
