# Jalna menu-link directory publication

Collected on 26 October 2026 from the public IndiaRestros API and indexed
District, Magicpin and Zomato menu pages. IndiaRestros terms permit personal
and commercial API use within published rate limits:
https://indiarestros.com/terms and https://indiarestros.com/api/docs.

The source inventory returned 264 records with menu entries. After collapsing
exact-name variants, 257 names were reviewed. Twelve separately found menu
pages supplied nine additional listings and three additional links for already
observed outlets. The final batch contains 249 publishable observations:

- 233 new directory profiles.
- 13 links matched to existing directory records by name/alias plus address
  evidence or nearby source map pins.
- 3 existing source profiles supplemented without replacing their stronger facts.
- 20 held records, including a closed listing, an unclear identity and possible
  duplicate/address conflicts. These are excluded from publication.

This is a menu-link publication, not a dish/menu import. No new recommendation
dishes, prices, dietary labels, photos, contacts, ratings, reviews or independent
verification claims were added. Source-reported menu counts are evidence only.
Source map pins are unverified. Indexed-only observations retain unknown
addresses and coordinates. Current operation and licence status remain unknown.

The compressed batch is bundled with the deployed application and participates
in its existing read-only directory query. No production Neon schema or data
write is needed. Links appear on directory cards and in Business details & menu.
Existing owner-provided menu links take precedence. No automatic chain-menu
inheritance or recommendation eligibility is granted to the new profiles.

The build script accepts the saved source inventory, per-outlet API detail files,
the pre-import live Jalna directory snapshot and existing source profiles. It
holds ambiguous identities rather than merging on a common name alone. Raw
responses containing third-party photos and contact data are not committed.

City searches serialize only their matching source profiles instead of sending
the full national catalogue into every directory query.

Validation: 26 targeted directory, source identity, provenance and discovery
tests passed before publication. A PGlite execution of the actual directory SQL
returned one record each for The Cake King, Krishna Kitchen and 7 Spices, with
working menu-source fields. The full suite has unrelated known baseline
failures recorded in the preceding audit; this publication does not resolve them.
