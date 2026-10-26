BEGIN;
ALTER TABLE public."Dish"
 ADD COLUMN IF NOT EXISTS city TEXT,
 ADD COLUMN IF NOT EXISTS area TEXT,
 ADD COLUMN IF NOT EXISTS cuisine TEXT,
 ADD COLUMN IF NOT EXISTS diet_type TEXT NOT NULL DEFAULT 'unknown' CHECK(diet_type IN ('unknown','vegetarian','egg','nonveg','jain','vegan')),
 ADD COLUMN IF NOT EXISTS ingredients_verified BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS meal_type TEXT,
 ADD COLUMN IF NOT EXISTS taste_tags TEXT[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS photo_url TEXT,
 ADD COLUMN IF NOT EXISTS photo_permission BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS photo_credit TEXT,
 ADD COLUMN IF NOT EXISTS source_urls TEXT[] NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS rating DOUBLE PRECISION CHECK(rating>=0 AND rating<=5),
 ADD COLUMN IF NOT EXISTS order_count INTEGER CHECK(order_count>=0),
 ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS dish_of_week BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS zomato_url TEXT,
 ADD COLUMN IF NOT EXISTS swiggy_url TEXT,
 ADD COLUMN IF NOT EXISTS call_phone TEXT,
 ADD COLUMN IF NOT EXISTS dining_options TEXT[] NOT NULL DEFAULT '{}';
UPDATE public."Dish" d SET city=r.city,area=r.address FROM public."Restaurant" r WHERE r.id=d."restaurantId" AND d.city IS NULL;
UPDATE public."Dish" SET diet_type=CASE WHEN "isVeg"=TRUE THEN 'vegetarian' WHEN "isVeg"=FALSE THEN 'nonveg' ELSE 'unknown' END WHERE diet_type='unknown';
CREATE OR REPLACE FUNCTION public.sync_basic_dish_diet() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.diet_type='unknown' THEN NEW.diet_type:=CASE WHEN NEW."isVeg"=TRUE THEN 'vegetarian' WHEN NEW."isVeg"=FALSE THEN 'nonveg' ELSE 'unknown' END;
 ELSIF TG_OP='UPDATE' AND NEW."isVeg" IS DISTINCT FROM OLD."isVeg" AND NEW.diet_type=OLD.diet_type THEN NEW.diet_type:=CASE WHEN NEW."isVeg"=TRUE THEN 'vegetarian' WHEN NEW."isVeg"=FALSE THEN 'nonveg' ELSE 'unknown' END;NEW.ingredients_verified:=FALSE;
 END IF;RETURN NEW;
END; $$;
CREATE OR REPLACE TRIGGER sync_basic_dish_diet BEFORE INSERT OR UPDATE ON public."Dish" FOR EACH ROW EXECUTE FUNCTION public.sync_basic_dish_diet();
CREATE TABLE IF NOT EXISTS public."DishSearch"(id UUID PRIMARY KEY,city TEXT NOT NULL,filters JSONB NOT NULL,"dishIds" INTEGER[] NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public."DishVote"(search_id UUID REFERENCES public."DishSearch"(id),dish_id INTEGER REFERENCES public."Dish"(id),vote SMALLINT NOT NULL CHECK(vote IN (-1,1)),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(search_id,dish_id));
CREATE TABLE IF NOT EXISTS public."DishSearchClick"(id UUID PRIMARY KEY,search_id UUID REFERENCES public."DishSearch"(id),dish_id INTEGER REFERENCES public."Dish"(id),action TEXT NOT NULL CHECK(action IN ('zomato','swiggy','call','directions','share','save','map')),"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS dish_city_diet_idx ON public."Dish"(LOWER(city),diet_type,price);
CREATE INDEX IF NOT EXISTS dish_vote_dish_idx ON public."DishVote"(dish_id);
ALTER TABLE public."DishSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DishVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DishSearchClick" ENABLE ROW LEVEL SECURITY;
COMMIT;
