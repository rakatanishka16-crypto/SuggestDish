# India HORECA candidate import

This workflow imports **unverified candidates** into a staging database. It
never creates public Restaurant or Dish records. Restaurants, cafés, takeaway
outlets, bakeries, hotels, guest houses, hostels, bars, and mapped caterers are
included. OSM coverage is incomplete and does not contain a verified menu.

## Source and preparation

Download the current India `india-latest.osm.pbf` from
https://download.geofabrik.de/asia/india.html using an ordinary browser or a
download tool. Keep the source date and checksum with the run record. The
extract was about 1.6 GB on 29 September 2026; processing requires substantial
free disk space. Install `osmium-tool` from its official package source.

From the repository root:

```sh
osmium tags-filter india-latest.osm.pbf \
  'nwr/amenity=restaurant,cafe,fast_food,food_court,bar,pub,biergarten,ice_cream' \
  'nwr/tourism=hotel,motel,guest_house,hostel' \
  'nwr/shop=bakery,pastry,confectionery,deli,caterer' \
  'nwr/craft=caterer' \
  -o india-horeca.osm.pbf
osmium export india-horeca.osm.pbf -f geojsonseq -a type,id \
  -u type_id -o india-horeca.geojsonseq
node scripts/import-india-horeca.js --input india-horeca.geojsonseq
```

The preview prints candidate counts by category. Review the sample source and
scope before writing. For an authorized **staging Neon database**, set
`STAGING_DATABASE_URL` locally in your shell or secret manager, then run:

```sh
node scripts/import-india-horeca.js --input india-horeca.geojsonseq --write
```

Do not paste credentials into chat or commit them to Git. The script ignores
`DATABASE_URL` and never writes to the production restaurant table.

## Review and publication

The `HorecaCandidate` table preserves OSM object ID, source link, category,
address and coordinates when the feature is a point. Polygon locations stay
blank until a reviewer determines the outlet entrance. Every imported row
remains `unverified`; reruns update source fields but preserve review status.

Before publishing a candidate, verify that the business operates, verify its
address and location, obtain at least one current dish from the business or a
permitted menu source, record the menu source and check date, and resolve
duplicates against existing `Restaurant` records. A separate, reviewed
promotion workflow must be built before any candidate enters recommendations.
Hotels without public dining can stay in the candidate inventory without a
dish listing.

OpenStreetMap data is licensed under ODbL 1.0. Preserve attribution in the
product and review database publication obligations before sharing derived
datasets. This import cannot provide complete India coverage.
