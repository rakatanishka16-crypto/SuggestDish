# IndiaRestros source audit and bulk-data gate

## Why this source is being evaluated

IndiaRestros publishes an India-focused restaurant and menu API with INR prices,
menu source links and freshness metadata. Its public API is suitable for a
small, read-only coverage audit before SuggestDish considers an integration.

## Run a non-persistent coverage audit

From the repository root in VS Code Terminal:

```bash
node scripts/audit-indiarestros-source.js
```

The script checks aggregate coverage for Mumbai, Pune, Delhi, Lucknow, Chennai,
Bengaluru, Kolkata, Hyderabad, Ahmedabad, Jaipur, Nagpur and Nashik. It requests
at most one restaurant result and five dish results per city. It writes only
aggregate counts to the terminal; it does not save restaurant rows, phone
numbers, contact details, menus or prices, and it does not connect to Neon.

## Bulk import is deliberately blocked pending provider approval

The provider's published guidance says commercial use is permitted within its
published rate limits, asks clients to cite restaurant URLs, and directs
whole-country or higher-volume users to contact the provider. It also says not
to bulk-copy contact details for unsolicited outreach. A city-wide or national
database replication is therefore not part of this audit.

Before any bulk import, request written confirmation from hello@indiarestros.com
covering:

- Whether SuggestDish may permanently store restaurant and menu records.
- Whether item-level INR prices may be cached and refreshed in Neon.
- Whether contact fields must be excluded from the imported dataset.
- Required attribution and restaurant-page links.
- Approved city/batch volume, rate limits and refresh frequency.
- Whether the provider can supply a licensed bulk export instead of API paging.

Until this is agreed, use the API only for permitted live lookups, obey response
cache headers and rate limits, and link back to the provider's restaurant URL.

## Existing SuggestDish data

The production database already contains an OSM-derived candidate directory.
Those candidate records are discovery leads, not menu-verified restaurants.
They must remain separate from recommendation-eligible Restaurant/Dish rows.
OSM-derived records carry ODbL attribution and should not be mixed into a
non-ODbL derived database without reviewing the applicable licence obligations.

## Import gate

No API result from this audit is inserted into Neon. A future licensed import
must first produce a dry-run report with:
- stable source IDs and duplicate-match decisions;
- source URL and source update/check date for every menu item;
- explicit price and currency;
- unknown dietary labels left unknown;
- city and locality evidence;
- a conflict/hold queue;
- a documented licence and attribution field.

Only after the provider's written permission and the dry-run review should a
separate import be applied to a Neon staging branch.
