BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM "Dish" d JOIN "Restaurant" r ON r.id=d."restaurantId" WHERE d.id=1067 AND r.id=169 AND r.name='The Couch Potato' AND r.city='Mumbai' AND r.address='WTC, Gate 6, Cuffe Parade, Mumbai, Maharashtra 400005' AND d.name='Mumbai Chaat Spud' AND d.price=179 AND d."isVeg"=true) THEN RAISE EXCEPTION 'Couch Potato source/menu mismatch';END IF;
 IF NOT EXISTS(SELECT 1 FROM "Dish" d JOIN "Restaurant" r ON r.id=d."restaurantId" WHERE d.id=1099 AND r.id=171 AND r.name='A Petal and Paniyaram' AND r.city='Mumbai' AND d.name='Masala Paniyaram' AND d.price=130 AND d."isVeg"=true) THEN RAISE EXCEPTION 'Petal and Paniyaram source/menu mismatch';END IF;
END $$;
INSERT INTO "SourceStarDish"("restaurantId","dishId","sourceUrl","evidenceKind","evidenceNotes") VALUES
(169,1067,'https://www.thecouchpotato.co.in/','bestseller','Official WTC Cuffe Parade menu labels Mumbai Chaat Spud Bestseller and lists regular size at INR 179; site states all food is vegetarian. Source checked 2026-10-04 IST. This is restaurant-published evidence, not audited order data or a verified owner claim.'),
(171,1099,'https://www.petalandpaniyaram.in/menu/','signature','Official Goregaon West menu includes Masala Paniyaram under Our Signature Specialties at INR 130 and states vegetarian food. Source checked 2026-10-04 IST. Selection is one of the restaurant-listed signature items, not a claim that it is the most ordered.')
ON CONFLICT("restaurantId") DO UPDATE SET "dishId"=EXCLUDED."dishId","sourceUrl"=EXCLUDED."sourceUrl","evidenceKind"=EXCLUDED."evidenceKind","evidenceNotes"=EXCLUDED."evidenceNotes","sourceCheckedAt"=NOW(),"expiresAt"=NOW()+INTERVAL '60 days';
COMMIT;
SELECT r.name,d.name AS dish,d.price,s."evidenceKind",s."expiresAt" FROM "SourceStarDish" s JOIN "Dish" d ON d.id=s."dishId" JOIN "Restaurant" r ON r.id=s."restaurantId" ORDER BY r.id;
