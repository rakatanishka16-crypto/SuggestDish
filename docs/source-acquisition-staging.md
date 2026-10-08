# Source acquisition staging

This first import covers the six-table Mumbai acquisition snapshot:
29 brand/business entities, 197 physical outlet records, 6,856 documented dish
records, 18 signals, 46 social profiles and 151 evidence sources (7,297 observations).
It does not yet import every historical source-catalog batch.

## VS Code Terminal — dry run

Open the current SuggestDish repository. Run:

```
node scripts/import-source-acquisition.js
```

This validates IDs, parent references, evidence references, dates and explicit
prices, and prints counts plus a stable snapshot hash. It does not connect to
a database, create tables or modify production records.

## VS Code Terminal — apply to configured Neon database

Use the existing secure DATABASE_URL environment setting or local untracked
.env file for the intended Neon branch. Never commit, share or print its value.
A connected database role must have CREATE TABLE and INSERT privileges.
Back up the intended database and verify the intended branch in Neon before applying.

```
node scripts/import-source-acquisition.js --apply
```

Success reports inserted and unchanged observation counts. The two tables are
SourceAcquisitionObservation and SourceAcquisitionImport. All writes run in one
transaction; an error rolls back the transaction. Repeating the same snapshot
adds zero observations. A changed payload adds a new immutable version and
retains previous conflicting evidence; no automated conflict resolution occurs.

## Limits

The migration runs on explicit apply only, never during server startup or a
public request. No Restaurant, Dish, owner, payment or recommendation table is
written. NULL diet stays NULL. Brand references keep a NULL outlet_id. Ratings,
prices and source signals are stored as observations, not certified facts.
This staging import does not make records recommendation-eligible. No apply
was performed while preparing this workflow because a secure local database
connection was unavailable.

Mock transaction tests cover idempotence, evidence history and rollback; live
PostgreSQL application still requires verification on the configured branch.
