# Mumbai official-source catalog

Checked 4 October 2026. This is a partial public-source collection, not a complete city census or owner/licence verification.

## Published data

- 73 business profiles: 60 Mumbai, 8 Thane and 5 Navi Mumbai.
- 512 menu entries across six brands; 248 entries have explicitly published INR prices.
- Thepla House: all 248 priced entries in its two-page source PDF, including vacuum-packed and pre-order variants.
- PizzaExpress: 130 entries, including source-labelled sizes and crust variants.
- Persian Darbar (Byculla): 84 entries from that operator's menu.
- Oye Kake: 24 entries; The Bombay Canteen: 17 all-day entries; Cream Centre: 9 signature entries.
- Each profile and menu entry retains its source URL and check date. Missing prices, hours and dietary labels remain unknown.

Cream Centre signatures are a partial menu. The Bombay Canteen's larger PDF contains overlapping extracted text and was not transcribed. The all-day menu records its published service window. Menu entries are brand reference information and do not establish branch availability or enter budget/dietary recommendations automatically.

Thepla House's five existing branch records remain mapped to their source profiles. Other names alone are not sufficient to merge branches. Price effective dates and tax inclusion remain unknown. Seasonal categories and pre-order notes are retained.

## Research audit

All 127 research leads were searched against the live directory. 69 searches returned possible candidates; these are not verified branch matches. Nine leads were corroborated with official profiles in the stated locality; 118 remain pending. The audit stores possible IDs separately from confirmed source profiles and is not exposed as public business records.

Opening-soon locations and conflicting or incomplete addresses are excluded from publication. Exact-source phone numbers are preserved without adding inferred prefixes. Registered offices are not treated as restaurant locations or branch licence evidence.

## Platforms and limits

Official business websites and menus supply the published observations. Existing OpenStreetMap/Geofabrik records remain available in the larger map directory; their presence does not confirm operations or menus.

Reddit is used for discovery leads only; posts, ratings and reviews are not republished. No bulk Instagram, Google Maps, Zomato, Swiggy or Justdial dataset has been imported. Accessible business-linked pages may support discovery, while published records use identifiable official sources.

[Maharashtra FDA](https://fda.maharashtra.gov.in/) and [FSSAI FoSCoS](https://foscos.fssai.gov.in/) are reference sources. No individual food licence has been verified. Platform-restricted datasets and licence results are not represented as collected data.

## Implementation and validation

The JSON source batch is bundled in the repository. A read-only catalog joins source profiles into directory search and exposes business details without adding production credentials or writing to Neon. `GET /api/data-coverage` reports published counts, platform availability and unresolved lead counts without exposing the research audit.

The business details panel links to official sources, shows uncertainty and supports local menu search. Text is rendered with DOM textContent; external links require HTTPS. Diet labels follow explicit source labels or clearly named meat/egg items; ambiguous items stay unknown.

The 80-test suite passes, including unique IDs, published price validation, preserved variants, explicit dietary labels, existing branch mappings and honest coverage counts. Production API and browser checks are performed after deployment.
