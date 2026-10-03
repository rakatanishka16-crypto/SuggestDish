BEGIN;
ALTER TABLE public."BusinessSubmission" ADD COLUMN IF NOT EXISTS "checkoutTokenHash" TEXT;
CREATE TABLE IF NOT EXISTS public."BusinessPlanPayment" (
 id UUID PRIMARY KEY,
 "submissionId" UUID NOT NULL REFERENCES public."BusinessSubmission"(id),
 "restaurantId" INTEGER NOT NULL REFERENCES public."Restaurant"(id),
 plan TEXT NOT NULL CHECK (plan IN ('monthly','annual')),
 amount INTEGER NOT NULL CHECK ((plan='monthly' AND amount=49900) OR (plan='annual' AND amount=499900)),
 currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency='INR'),
 "keyId" TEXT NOT NULL,
 "orderId" TEXT UNIQUE,
 "paymentId" TEXT UNIQUE,
 status TEXT NOT NULL DEFAULT 'creating' CHECK (status IN ('creating','created','captured','refunded')),
 "startsAt" TIMESTAMPTZ,
 "endsAt" TIMESTAMPTZ,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS business_payment_restaurant ON public."BusinessPlanPayment" ("restaurantId",status,"endsAt");
COMMIT;

-- Both webhook and browser confirmation call this atomically; duplicates do not extend the plan.
CREATE OR REPLACE FUNCTION public.confirm_business_payment(local_id UUID, gateway_payment_id TEXT, is_refunded BOOLEAN)
RETURNS public."BusinessPlanPayment" LANGUAGE plpgsql AS $$
DECLARE p public."BusinessPlanPayment"%ROWTYPE;
BEGIN
 SELECT * INTO p FROM public."BusinessPlanPayment" WHERE id=local_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown order'; END IF;
 IF p."paymentId" IS NOT NULL AND p."paymentId"<>gateway_payment_id THEN RAISE EXCEPTION 'Payment mismatch'; END IF;
 IF is_refunded OR p.status='refunded' THEN
  UPDATE public."BusinessPlanPayment" SET status='refunded',"paymentId"=gateway_payment_id WHERE id=local_id RETURNING * INTO p;
 ELSIF p.status<>'captured' THEN
  UPDATE public."BusinessPlanPayment" SET status='captured',"paymentId"=gateway_payment_id,"startsAt"=NOW(),"endsAt"=NOW()+CASE WHEN plan='monthly' THEN INTERVAL '1 month' ELSE INTERVAL '1 year' END WHERE id=local_id RETURNING * INTO p;
 END IF;
 RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_business_payment(local_id UUID, submission_id UUID, restaurant_id INTEGER, plan_code TEXT, amount_paise INTEGER, merchant_key TEXT)
RETURNS TABLE(id UUID) LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(67423005,restaurant_id);
 IF EXISTS (SELECT 1 FROM public."BusinessPlanPayment" p WHERE p."restaurantId"=restaurant_id AND p."keyId"=merchant_key AND ((p.status='captured' AND p."endsAt">NOW()) OR p.status='created' OR (p.status='creating' AND p."createdAt">NOW()-INTERVAL '30 minutes'))) THEN RETURN; END IF;
 RETURN QUERY INSERT INTO public."BusinessPlanPayment" (id,"submissionId","restaurantId",plan,amount,"keyId") VALUES (local_id,submission_id,restaurant_id,plan_code,amount_paise,merchant_key) RETURNING "BusinessPlanPayment".id;
END;
$$;
