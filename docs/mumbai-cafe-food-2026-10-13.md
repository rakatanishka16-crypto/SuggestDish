# Mumbai official food menu batch — 13 October 2026

Adds 299 priced food records with vegetarian evidence, exact outlet associations,
source URLs and retrieval dates. This is a partial collection, not a city census.

| Outlet | Area | Food records | Scope |
|---|---|---:|---|
| Epilicious Cafe & Cakes | Goregaon East | 35 | PDF food page |
| Hopleaf Restobar & Lounge | Borivali West | 36 | Soup and Small Plates |
| Celebration 365 Pure Veg Family Restaurant | Borivali West | 228 | All published food categories |

Sources:
- https://www.epilicious.in/wp-content/uploads/2025/07/Epilicious-Cafe-Menu-2025_compressed.pdf
- https://www.epilicious.in/
- https://www.hopleaf.in/
- https://www.celebration365.in/menu
- https://www.celebration365.in/menu-items.json

Epilicious's green veg symbol and official website supply dietary evidence. Its
PDF is labelled 2025; retrieval today does not establish a current effective
price. The six waffle choices share the published section price of INR 160.
Hopleaf explicitly states that its food uses pure vegetarian ingredients.
Its 36 retained foods are confined to two complete sections; the remaining
sections still need collection. Government taxes are additional. Variant labels
are retained; Jain preparation is not independently verified.

Celebration's official site states 100% vegetarian and supplies its branch
address and coordinates as structured data. Menu UI loads the same-origin
menu-items.json. All 228 food records have explicit numeric prices; 19 separately
labelled beverages are excluded. GST of 5% is additional. Item descriptions,
photos, phone numbers and marketing copy are not republished.

Names and source prices remain observations. No ratings, review counts, current
stock, popularity or owner verification are invented. Only Celebration has
source-published coordinates; the other two branches remain city-search-only.

The existing catalogue importer can archive and publish this batch with duplicate
and conflicting-price checks. Source publication alone does not mean Neon import
is complete. Temporary import access is currently disabled; production execution
must be verified separately.
