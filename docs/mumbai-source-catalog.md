# Mumbai official-source catalog

Published collection: 25 business profiles (22 Mumbai, 2 Thane, 1 Navi Mumbai) and 53 brand-level menu entries (24 Oye Kake; 29 Thepla House). Sources were checked on 4 October 2026. Thepla House PDF prices were checked against its rendered price columns; Oye Kake does not publish prices for the transcribed entries. This is partial coverage, not a business census.

The API combines the versioned catalog with existing Neon directory records using a read-only SQL query. Exact case-insensitive name and address matches reuse the existing directory record and receive a source-profile link. Five Thepla House branches also use explicit live directory IDs after reconciling their published addresses; this handles the existing branch suffixes and address formatting without guessing by brand alone. Different branches and incomplete addresses are not guessed into one business. The catalog persists in the Git repository and deployment; no Neon rows, credentials or privileged import endpoints are changed.

/api/business-source returns official business details and brand menu references. Business cards expose an expandable details panel with contacts, hours, source date, source links, portions, available source-menu prices and explicit uncertainty. New catalog businesses link to the existing submission form for owner review; existing database candidates retain their claim workflow. Brand menus do not enter the recommendation engine until branch, current price and dietary preparation are separately checked. There are no copied dish images or invented ratings, coordinates, licence verification or ingredients.

Older community and unresolved listing leads remain unpublished. Instagram, Google, Zomato, Swiggy, Reddit APIs and government records are not presented as scraped or verified where access or outlet-level checks were not available. Official sources include restaurant websites, a hotel restaurant website, caterer contact pages and an official restaurant link hub.

Validation: 78 Node tests pass, including fixed catalog scope, absent-price behavior, API identifier validation and directory query binding. Live read-only API and browser checks follow deployment.

Automatic approval review rejected creating HORECA_IMPORT_TOKEN as new privileged production access. This implementation uses the safer read-only catalog approach; that credential and its import endpoint were not created.
