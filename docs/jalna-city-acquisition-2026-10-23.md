# Jalna city acquisition — 23 October 2026

Production baseline inspected through both pages of `/api/business-directory?city=Jalna&limit=50`: 53 directory rows, including existing duplicate candidates. `/api/menu-coverage?city=Jalna`: 31 restaurants with 933 priced dish records. These are existing records, not newly collected or independently verified menus.

## Collected observations

- 27 Jalna city eatery/operator entries from Maharashtra's public Shiv Bhojan eatery allocation report. Ten entries in other towns of Jalna district are held outside the city publication scope.
- Four official website observations linked to existing restaurant IDs: Saffron (6), Saawariya (30), Crazy Cheesy (14), Khatirdari (54). These enrich directory sources without inserting duplicate restaurant/menu rows.
- The government report's numbers are plate allocations, never prices. Scheme participation does not establish current operation, open access, dietary preparation or menu availability.
- Official observations were retrieved through public web search. Failed direct requests are recorded in the batch; this is not a fresh direct scrape of those sites. No ratings, review text, descriptions, images, inferred coordinates or unpriced dishes were added.
- Fern's factsheet and contact page disagree on plot number (11438/11483); retain this conflict for owner review.

The additions use the existing source-catalogue directory mechanism. A database menu import is unnecessary because this batch has zero eligible priced dishes. Deploying source files makes these listings available in the existing business directory; it does not add dishes to recommendations. `/api/jalna-acquisition` exposes the exact observations, sources, held towns and limitations.

## Remaining gaps

Menucard has PDFs for local restaurants but its terms limit use to personal non-commercial use and prohibit reuse without permission. Those menus were not transcribed or imported. Zomato/Swiggy and other aggregators were used as discovery leads, not copied into this batch. Official city pages were sought for local cafes/chains; national menus were not assigned to Jalna branches.

Fresh bounded Overpass requests failed (HTTP 406 and alternate endpoint timeout). Existing OSM observations are unchanged. Many search hits are businesses on Jalna Road in Chhatrapati Sambhajinagar, which are outside this city scope.

Owner-supplied current menus with permission to publish, branch addresses/map pins, portion sizes and vegetarian/egg/nonvegetarian markers are the useful next input. Unknown fields must remain unknown. A complete city census and current price coverage cannot be claimed.

## Validation

The acquisition tests verify city scope, unique identities, exact existing restaurant links, preservation of unknown fields, zero new recommendation menus, and separation of the original OSM export from this government/official batch. After deployment, inspect directory totals and source responses and confirm the existing 933 priced dishes remain unchanged.
