# Collected catalogue publication

This import saves the current bundled source catalogue and Mumbai acquisition evidence in production Neon, then publishes only exact-outlet menu items with finite positive prices, known dietary labels, dated HTTPS sources and no recorded conflicts. Directory-only listings and national brand references remain listings/evidence; they do not become invented outlet menus.

The reviewed input currently contains 8,027 outlet profiles, 50,303 deduplicated source observations, and 3,547 candidate dish records across 116 outlet profiles. Fifteen of those outlet profiles are labelled Mumbai. These are plan counts, not completed production insert counts. Matching existing restaurants/dishes or holding existing conflicts can reduce actual new inserts.

Includes the two-outlet Breakfast Kitchen/Suhani source batch and restores Hotel Chul's existing detailed menu association. Unknown dietary labels remain source evidence. Unknown coordinates remain absent; such dishes are eligible only for city searches, not nearby radius searches. Imported source labels are not owner verification, popularity or current-stock confirmation.

## Execution

Use the temporary `SOURCE_CATALOG_IMPORT_KEY` secret in the SuggestDish production project. The endpoint is POST-only, disabled when that key is absent, and accepts a server-held fixed snapshot, not uploaded SQL/data or arbitrary file paths. Each write requires the exact plan digest. It stores evidence in CatalogueObservation, outlet links in CatalogueRestaurant, dish provenance in CatalogueDish, and completed batches in CatalogueImportRun. Each batch runs in a transaction and takes an advisory lock. Repeating a completed batch is read-only; existing mismatched prices/diets are held without overwriting them.

Run `node scripts/publish-collected-catalogue.cjs` for a plan, then `node scripts/publish-collected-catalogue.cjs --apply` for all archive and publication batches. The key is loaded from the private environment, never logged, committed or supplied in a URL. The local report can resume via idempotent replay after interruption.

After execution, verify menu-coverage/recommendation-coverage and sample dish requests against the deployed production site. Disable the temporary import key and remove the local credential. Do not claim completion from a merged PR or deployment alone.

## Validation

Seven importer tests cover exact outlet mapping, unknown diets, conflicting prices, portion identity, archival retention, digest validation, fail-closed authentication, rollback and idempotent replay. The location/recommendation integration tests pass. Two existing broad catalogue assertions fail on the supplied source-data baseline: newer branch observation status labels and missing optional licence fields. The importer does not convert either into an invented fact.

Production execution is pending explicit merge approval after automatic approval review rejected merging the earlier standalone menu PR #59. No Neon import has run.
