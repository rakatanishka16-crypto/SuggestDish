# Remaining chain outlet observations — 5 October 2026

2,042 distinct official-source listings added to the searchable outlet directory, alongside the previous 2,591 chain records. These are source observations, not owner verification or a complete India census.

| Brand | Added distinct listings | Scope |
| --- | ---: | --- |
| La Pino'z Pizza | 627 | Official locator cards; locality and city address only, source coordinates |
| McDonald's | 317 | North/East locator and one checked West/South branch |
| Haldiram's | 153 | Official city locator; retail shops and base kitchens retained as named |
| Wow! Momo | 707 | All 119 official listing pages observed; repeated addresses deduplicated |
| The Belgian Waffle Co. | 70 | Partial observed locator set, including Civil Club Business Center, Jalna |
| Jumboking | 156 | Indian city/region directories; UAE excluded |
| Chai Sutta Bar | 8 | Public location cards |
| Chaayos | 4 | Artha Mart branch page and its three explicitly addressed nearby branches |
| Mojo Pizza | 0 | Public site uses delivery-location selection; usable official outlet address set not obtained |

Each listing has an official source link and observation date. Missing state, coordinates, phones, opening hours, reviews and licence facts remain unconfirmed. One Jumboking state-only record and a McDonald's blank Test City card are excluded. Belgian Waffle records with conflicting source state metadata retain the published address but leave state unconfirmed. Wow! Momo addresses preserve published text; some locator line breaks were absent in exports.

Only twelve fully named menu items with displayed prices from McDonald's Aurangabad Jalna branch page are attached to that outlet. This outlet is in **Aurangabad, on Jalna Road**, not Jalna city. Truncated names were not imported. Prices were observed on 5 October; final tax, customisation, stock and current price require confirmation. Menus from national catalogs or other branches are not copied onto these new outlets.

The data is deployed as a fixed gzip function asset and served through existing directory/search and business-source APIs. It is not an insertion into the owner-verified recommendation tables. `/api/data-coverage` exposes chain counts and remaining coverage limits.

Rebuild with `python3 scripts/build-remaining-chain-source-batch.py --input-dir <public-locator-json-export-directory> --output api/source-batches/remaining-chain-outlets-2026-10-05.json.gz`. Export inputs are dated, brand-specific JSON cards read from rendered official pages; the gzip is deterministic.
