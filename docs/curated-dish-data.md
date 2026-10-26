# Curated dish discovery

Validate without changing data:

    node scripts/seed-curated-dishes.js data/curation/jalna-dishes.csv

Import with the intended database credentials already supplied in the environment:

    node scripts/seed-curated-dishes.js data/curation/jalna-dishes.csv --apply

The CSV is intentionally header-only. Do not invent dish prices, reviews, order counts, verification dates, contact details, photos or dietary certifications. Use an existing Restaurant id in restaurant_id. Provide id to update a dish belonging to that restaurant; leaving id empty creates a new record. Reimporting new rows without an id creates duplicates, so retain the assigned ids for subsequent updates. Imports are transactional.

Use pipes to separate taste_tags, source_urls and dining_options. Booleans are true/false. Permitted diet types: vegetarian, egg, nonveg, jain, vegan. Jain and vegan require ingredients_verified=true based on documented preparation/ingredients. Existing boolean vegetarian records migrate to vegetarian/nonveg; egg, Jain and vegan need separate curation. No stricter diet is inferred from dish names. A photo requires photo_permission=true, a credit and an owner permission or usable licence; do not scrape food marketplace images. Include evidence in source_urls. Leave unknown verification dates, rating, order_count, photos and action links blank. dish_of_week=true opts a dish into that city's banner; flag only one current dish per city.

Ranking: taste 30, cuisine 25, budget fit up to 15, rating up to 10, verification recency up to 10 over 180 days, thumbs-up ratio up to 10. Diet, budget, requested dish, meal type, known dining availability and GPS radius filter candidates first. Sponsorship adds no score. Paid photo promotions have a separate, labelled row with up to two eligible slots; paid entries are not promoted through the organic ranking. Unknown fields contribute no invented signals. Gemini extracts filters only, with a 1.2-second timeout and deterministic parsing fallback.

Search and click records contain random search IDs, city, coarse filter values, displayed dish IDs and actions. They do not store free text, coordinates, names, email, browser IDs or IP addresses. One vote per dish/search is replaceable. These are event counts, not verified customers or orders.
