# Mumbai official menu expansion — 23 October 2026

Live baseline: 34 Mumbai restaurants with 2,418 priced dish records. The scope covers La Sanazaar Cafe in Juhu and Sudama All Veg at Krishna Palace Hotel, 96/98 Sleater Road, Nana Chowk. It is not a Mumbai census. Both source profiles already exist; neither is duplicated.

## Source observations

- https://lasanazaarcafe.com/ — 359 earlier observations receive fresh source-section context; two previously collapsed cake-price variants are preserved separately, for 361 observations. Dietary status uses explicit vegetarian/nonvegetarian sections or source variant labels. Eggless-only bakery sections remain unknown. Zero placeholders, a suspicious ₹8,888 veg sizzler price, contradictory seafood/veg labels and grouped choices are held. Of these observations, 212 pass recommendation import checks.
- https://www.krishnapalaceresidency.com/mumbai/facilities/pdf/sudama-a-la-carte-menu-august-23.pdf — 135 additional unambiguous menu records on pages 3–14, using the hotel's vegetarian restaurant/separate veg kitchen statement. Earlier 13 dosa variants retain their IDs and association. The PDF filename includes August 23; no effective price date or current price guarantee is asserted. Taxes and service charge are additional as printed. Corn Cheese Balls has conflicting prices on two pages and is excluded. A conflicting Neer Dosa price is recorded without changing prior database records.

Official pages were inspected through the web retrieval service; direct local downloads returned 406/503. No access restriction was bypassed. Names, source sections, portion labels and prices are factual observations; marketing copy, photos and reviews are not republished. Locations lack verified coordinates, so these additions support city searches rather than nearby radius searches.

## Publication

`mumbai-official-menu-expansion-2026-10-23` is a fixed authenticated catalogue-import scope: two outlet profiles, 994 evidence records, 347 eligible dish records, 140 unknown-diet holds and nine source-conflict holds. The scope does not import unrelated cities. Existing conflicting database prices or dietary values are held, never overwritten. Transactions, digest validation and idempotent replay use the existing importer.

`python scripts/publish-mumbai-oct23.py` requests a read-only plan. `--apply` archives and publishes this exact scope with the returned digest. Credentials must remain private and temporary import access must be disabled and redeployed afterward. Actual insert/link/conflict counts come from the execution report; 347 is the plan count until application and live verification succeed.

`/api/mumbai-acquisition-20261023` reports source-preparation counts, not database completion. Compare live `/api/menu-coverage?city=Mumbai` before and after application and test dish recommendations. The website presentation is unchanged.
