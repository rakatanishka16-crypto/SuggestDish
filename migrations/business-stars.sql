BEGIN;
CREATE TABLE IF NOT EXISTS public."BusinessClaim" (
 id UUID PRIMARY KEY,"sourceKey" TEXT REFERENCES public."HorecaCandidate"("sourceKey"),"restaurantId" INTEGER REFERENCES public."Restaurant"(id),
 "businessName" TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,"contactName" TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,"profileUrl" TEXT NOT NULL,"ownershipEvidence" TEXT NOT NULL,"tokenHash" TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','needs_information')), "reviewNotes" TEXT,"reviewedAt" TIMESTAMPTZ,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS single_approved_business_claim ON public."BusinessClaim"("restaurantId") WHERE status='approved';
CREATE UNIQUE INDEX IF NOT EXISTS pending_claim_email ON public."BusinessClaim" (COALESCE("sourceKey",'restaurant:'||"restaurantId"::text), LOWER(email)) WHERE status IN ('pending','needs_information');
CREATE INDEX IF NOT EXISTS business_claim_queue ON public."BusinessClaim"(status,"createdAt");
CREATE TABLE IF NOT EXISTS public."StarDishRevision" (
 id UUID PRIMARY KEY,"claimId" UUID NOT NULL REFERENCES public."BusinessClaim"(id),slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),
 name TEXT NOT NULL,price DOUBLE PRECISION NOT NULL CHECK(price>0 AND price<=100000),"isVeg" BOOLEAN NOT NULL,"menuUrl" TEXT NOT NULL,"popularityBasis" TEXT NOT NULL CHECK("popularityBasis" IN ('most_ordered','customer_favourite','signature')),"popularityEvidence" TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','needs_information')),"reviewNotes" TEXT,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"reviewedAt" TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_star_revision ON public."StarDishRevision"("claimId",slot) WHERE status='pending';
CREATE TABLE IF NOT EXISTS public."RestaurantStarDish" (
 "restaurantId" INTEGER NOT NULL REFERENCES public."Restaurant"(id),slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3),"dishId" INTEGER NOT NULL REFERENCES public."Dish"(id),"revisionId" UUID NOT NULL REFERENCES public."StarDishRevision"(id),"popularityBasis" TEXT NOT NULL,"popularityVerified" BOOLEAN NOT NULL DEFAULT false,"approvedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY("restaurantId",slot),UNIQUE("restaurantId","dishId")
);
COMMIT;
CREATE OR REPLACE FUNCTION public.restaurant_star_limit(rid INTEGER) RETURNS INTEGER LANGUAGE sql STABLE AS $$
 SELECT COALESCE(MAX(CASE plan WHEN 'monthly' THEN 3 WHEN 'annual' THEN 2 END),1)::INTEGER FROM public."BusinessPlanPayment" WHERE "restaurantId"=rid AND status='captured' AND "startsAt"<=NOW() AND "endsAt">NOW() AND LEFT("keyId",9)='rzp_live_';
$$;
CREATE OR REPLACE FUNCTION public.approve_business_claim(cid UUID,notes TEXT) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE c public."BusinessClaim"%ROWTYPE; h public."HorecaCandidate"%ROWTYPE;rid INTEGER;
BEGIN
 SELECT * INTO c FROM public."BusinessClaim" WHERE id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown claim';END IF;
 IF c.status='approved' THEN RETURN c."restaurantId";END IF;
 IF c.status NOT IN ('pending','needs_information') OR LENGTH(TRIM(notes))<20 THEN RAISE EXCEPTION 'Review required';END IF;
 PERFORM pg_advisory_xact_lock(67423006);
 rid=c."restaurantId";
 IF c."sourceKey" IS NOT NULL THEN
  SELECT * INTO h FROM public."HorecaCandidate" WHERE "sourceKey"=c."sourceKey" FOR UPDATE;
  rid=h."restaurantId";
  IF rid IS NULL THEN
   SELECT MIN(id) INTO rid FROM public."Restaurant" WHERE LOWER(TRIM(name))=LOWER(TRIM(c."businessName")) AND LOWER(TRIM(city))=LOWER(TRIM(c.city)) AND LOWER(TRIM(address))=LOWER(TRIM(c.address));
   IF rid IS NULL THEN INSERT INTO public."Restaurant"(name,city,address,"updatedAt") VALUES(c."businessName",c.city,c.address,NOW()) RETURNING id INTO rid;END IF;
   UPDATE public."HorecaCandidate" SET "restaurantId"=rid WHERE "sourceKey"=c."sourceKey";
  END IF;
 END IF;
 IF rid IS NULL OR EXISTS(SELECT 1 FROM public."BusinessClaim" WHERE "restaurantId"=rid AND status='approved') THEN RAISE EXCEPTION 'Business already claimed';END IF;
 UPDATE public."BusinessClaim" SET status='approved',"restaurantId"=rid,"reviewNotes"=notes,"reviewedAt"=NOW() WHERE id=cid;
 RETURN rid;
END;
$$;
CREATE OR REPLACE FUNCTION public.approve_star_revision(rev UUID,notes TEXT,popularity_checked BOOLEAN) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE s public."StarDishRevision"%ROWTYPE;c public."BusinessClaim"%ROWTYPE;did INTEGER;
BEGIN
 SELECT * INTO s FROM public."StarDishRevision" WHERE id=rev FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown revision';END IF;
 IF s.status='approved' THEN SELECT "dishId" INTO did FROM public."RestaurantStarDish" WHERE "revisionId"=rev;RETURN did;END IF;
 SELECT * INTO c FROM public."BusinessClaim" WHERE id=s."claimId" AND status='approved' FOR UPDATE;
 IF NOT FOUND OR s.status<>'pending' OR LENGTH(TRIM(notes))<20 THEN RAISE EXCEPTION 'Approved owner and independent menu review required';END IF;
 PERFORM pg_advisory_xact_lock(67423007,c."restaurantId");
 IF s.slot>public.restaurant_star_limit(c."restaurantId") THEN RAISE EXCEPTION 'Plan limit exceeded';END IF;
 -- A reviewed revision creates a new dish snapshot; existing menus remain untouched.
 INSERT INTO public."Dish"(name,price,"isVeg","restaurantId","updatedAt") VALUES(s.name,s.price,s."isVeg",c."restaurantId",NOW()) RETURNING id INTO did;
 INSERT INTO public."DishSignal"("dishId",source) VALUES(did,s."menuUrl");
 INSERT INTO public."RestaurantStarDish"("restaurantId",slot,"dishId","revisionId","popularityBasis","popularityVerified") VALUES(c."restaurantId",s.slot,did,s.id,s."popularityBasis",popularity_checked)
 ON CONFLICT("restaurantId",slot) DO UPDATE SET "dishId"=EXCLUDED."dishId","revisionId"=EXCLUDED."revisionId","popularityBasis"=EXCLUDED."popularityBasis","popularityVerified"=EXCLUDED."popularityVerified","approvedAt"=NOW();
 UPDATE public."StarDishRevision" SET status='approved',"reviewNotes"=notes,"reviewedAt"=NOW() WHERE id=rev;
 IF s.slot=1 THEN
  INSERT INTO public."BusinessSubmission"(id,"duplicateKey","businessName",category,city,address,"contactName",email,phone,"profileUrl","menuUrl","dishName","dishPrice","isVeg",status,"restaurantId","checkoutTokenHash","verifiedSourceUrl","verificationNotes","reviewedAt")
  VALUES(c.id,'claim:'||c.id::text,c."businessName",'Restaurant',c.city,c.address,c."contactName",c.email,c.phone,c."profileUrl",s."menuUrl",s.name,s.price,s."isVeg",'approved',c."restaurantId",c."tokenHash",c."profileUrl",notes,NOW()) ON CONFLICT(id) DO NOTHING;
 END IF;
 RETURN did;
END;
$$;
