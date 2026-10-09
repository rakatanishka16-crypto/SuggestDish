# Mumbai open data — 9 October 2026

Source catalog release: 1,806 named restaurant/cafe/fast-food/food-court profiles. 28 fuzzy name matches within 100 m of existing profiles held without automatic merging. 74 unnamed or non-target cuisine-only objects held. Existing Neon OSM identities use `osm:node/ID` or `osm:way/ID`; directory joins match those explicitly before listing new source-only records. No Neon insert occurred. Distinct same-source OSM nodes/ways remain distinct pending evidence.

OpenStreetMap profile data and match metadata: ODbL 1.0, © OpenStreetMap contributors, https://www.openstreetmap.org/copyright . Public machine-readable adapted dataset: `/api/open-food-data/export` and `api/source-batches/mumbai-open-data-2026-10-09.json.gz`. Keep OSM licence/provenance on reuse. Other historical official-source datasets are independently sourced and are not relabelled as ODbL.

208 Wikidata India-origin food/dish vocabulary entries are separately exposed through `/api/dish-vocabulary`. CC0 1.0, https://www.wikidata.org/wiki/Help:Data_access . They include food products, not only prepared dishes. No restaurant associations, prices or dietary claims were added. P527 component statements are ingredient candidates requiring recipe verification. No recommendations consume this vocabulary as outlet dishes.

Administrative coverage: OSM relations 7964376 (Mumbai City), 7964375 (Mumbai Suburban). 9 October retrievals; way pins are bbox centers, not verified entrances. Missing addresses remain NULL. Operation, quality, licence validity, ratings, reviews, menu availability remain unconfirmed. Gateway failures were resolved by lower-resource district queries. Stale alternative-instance data was excluded. No Google/Instagram/delivery platform scraping.

Rebuild with `python3 scripts/build-mumbai-open-data.py RESTAURANTS_CSV DISHES_CSV EXISTING_PROFILES_JSON`. Review generated held/match arrays before release. Do not rerun against already-imported catalog profiles without reviewing source identities. Original pipeline and CSV checkpoint remain separate reusable artifacts.

Follow-up: 23 named amenity=ice_cream objects from the same 9 October licensed snapshot added after cross-source name/100 m candidate checking. No additional duplicate candidates, menus, prices, vocabulary entries or Neon inserts. Source profile count is now 1,800; total application source profiles 7,617. Retrieval dates are preserved, not rewritten as new observations.

Second follow-up: six additional named food shops/crafts classified from original raw OSM shop/craft tags, retained in mumbai-osm-food-shop-tags-2026-10-09.json. 2 bakeries, 1 pastry shop, 1 confectionery shop, 1 confectionery craft, 1 caterer. No new duplicate candidates. Current profiles 1,806; held 74; total application source profiles 7,623. No new menus, prices or Neon inserts. Hotels, bars and ambiguous building/cuisine-only records remain held; no food service inferred.
