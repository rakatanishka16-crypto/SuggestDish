-- Payment pricing and eligibility alignment. Existing payment records are preserved.
BEGIN;
ALTER TABLE public."BusinessPlanPayment" DROP CONSTRAINT "BusinessPlanPayment_check", ADD CONSTRAINT "BusinessPlanPayment_check" CHECK ((plan='monthly' AND amount IN (49900,79900)) OR (plan='annual' AND amount IN (399900,499900)));

CREATE OR REPLACE FUNCTION public.reserve_business_payment(local_id UUID, submission_id UUID, restaurant_id INTEGER, plan_code TEXT, amount_paise INTEGER, merchant_key TEXT) RETURNS TABLE(id UUID) LANGUAGE plpgsql AS $$
DECLARE expected INTEGER;
BEGIN
 expected:=CASE WHEN NOW()<'2027-01-01T18:30:00Z'::timestamptz THEN CASE plan_code WHEN 'monthly' THEN 49900 WHEN 'annual' THEN 399900 END ELSE CASE plan_code WHEN 'monthly' THEN 79900 WHEN 'annual' THEN 499900 END END;
 IF expected IS NULL OR amount_paise<>expected THEN RAISE EXCEPTION 'Invalid plan price'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public."BusinessSubmission" s WHERE s.id=submission_id AND s."restaurantId"=restaurant_id AND (s.status='approved' OR (s.status='pending' AND s."verificationNotes" LIKE 'owner_self_published_v1%'))) THEN RAISE EXCEPTION 'Published business required'; END IF;
 PERFORM pg_advisory_xact_lock(67423005,restaurant_id);
 IF EXISTS(SELECT 1 FROM public."BusinessPlanPayment" p WHERE p."restaurantId"=restaurant_id AND p."keyId"=merchant_key AND ((p.status='captured' AND p."endsAt">NOW()) OR p.status='created' OR (p.status='creating' AND p."createdAt">NOW()-INTERVAL '30 minutes'))) THEN RETURN; END IF;
 RETURN QUERY INSERT INTO public."BusinessPlanPayment"(id,"submissionId","restaurantId",plan,amount,"keyId") VALUES(local_id,submission_id,restaurant_id,plan_code,amount_paise,merchant_key) RETURNING "BusinessPlanPayment".id;
END; $$;

CREATE OR REPLACE FUNCTION public.restaurant_star_limit(rid INTEGER) RETURNS INTEGER LANGUAGE sql STABLE AS $$ SELECT CASE WHEN EXISTS(SELECT 1 FROM public."BusinessPlanPayment" WHERE "restaurantId"=rid AND status='captured' AND "startsAt"<=NOW() AND "endsAt">NOW() AND LEFT("keyId",9)='rzp_live_') THEN 2 ELSE 1 END::INTEGER; $$;
COMMIT;
