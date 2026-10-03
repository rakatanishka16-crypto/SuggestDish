# Nationwide business directory

Source: Geofabrik India OpenStreetMap extract, https://download.geofabrik.de/asia/india.html. Data © OpenStreetMap contributors, ODbL 1.0. This is partial mapping coverage, not an exhaustive list of Swiggy, Zomato, Google or all Indian businesses.

Run `python scripts/extract-india-food.py /path/to/india-latest.osm.pbf data/india` (requires Python osmium). It extracts named restaurant/cafe/fast-food/food-court/ice-cream/bar/pub, bakery/confectionery/deli/pastry/catering, craft=caterer, and hotel/motel/guest-house/resort source objects. Hotel/pub classification does not verify current food service. Explicit closed/disused objects are skipped where tagged. Missing addresses/cities are preserved as empty; only node coordinates are imported. Way/relation coordinates remain unknown.

Run `python scripts/build-directory-import.py data/india/osm-horeca-candidates.json /path/to/batches`. Import batches into HorecaCandidate using Neon SQL Editor. Unique source keys and ON CONFLICT DO NOTHING preserve all previously reviewed source records and restaurant links. Repeated imports do not create duplicate source objects. Separate OSM objects can still represent one outlet; do not claim distinct object count is a verified unique business count.

No Restaurant or Dish records are created from this dataset. Existing recommendation menus remain reviewed independently. /api/business-directory queries paginated source objects plus existing restaurant records without linked candidate records. City searches match recorded city/address text; outlets missing these fields may only be discoverable by name. Owners can submit missing businesses for review.

Snapshot time and per-category/completeness counts are recorded in data/india/coverage.json. Bulk platform coverage requires access/licensing suitable for redistribution, rather than claiming open-map coverage equals those platforms.
