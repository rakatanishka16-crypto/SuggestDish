# Jalna FoSCoS directory import — 27 October 2026

The approved report contains 3,346 unique FSSAI numbers collected from active
restaurant, hotel, snack/tea-shop, hawker and bakery-name searches. It is not a
complete city/district census. Bakery-name searches were stopped at the user's
request; the later cake-name search was not submitted.

The import preserves all 3,346 approved records in the compressed source batch.
It publishes 3,329 records as 3,324 directory profiles: five same-name,
same-address records are grouped while preserving every FSSAI number. Ten
school/institution records, five medical-store records and two conflicting
district/locality records are held from public outlet results. Bar-related names
were excluded during collection and are checked again by the builder. Juice bars
remain eligible; the dataset does not certify alcohol-free operation.

Jalna's administrative tag maps to Jalna city; Ambad, Partur, Bhokardan,
Badnapur, Ghansawangi, Jafrabad and Mantha retain separate city values. These are
registry administrative labels, not independently verified municipal boundaries.
The city profile counts are in the source batch summary and `/api/data-coverage`.

Each directory profile exposes the registered name/address, FSSAI number, type,
Active status, source search URL and the actual observation date (26 or 27 October).
Active registry status does not imply safety certification, owner verification,
current operation, a menu, a price or dietary suitability. No dishes, menus,
ratings, contacts, photos, coordinates or distances are fabricated. The records
enter the existing versioned source directory, not the Dish recommendation table.

The merge enriches an existing profile only for a unique exact normalized
name/address/city match or an identical FSSAI number. Approximate trading-name
matches are kept separate. FSSAI record counts therefore do not equal a confirmed
count of distinct physical venues.

Rebuild from the reviewed report:

```sh
python3 scripts/build-jalna-fssai.py /absolute/path/to/Jalna_FSSAI_Restaurants_Excluding_Bars.md
```

The batch records the report's SHA-256 and uses deterministic gzip output. The
builder performs no network requests or database mutations. Runtime loading uses
the same source-catalogue path as the existing published directory, preserving
earlier menus, owner details and recommendation eligibility.

Validation: 32 targeted directory, source, owner-prefill and FSSAI tests passed,
including real PostgreSQL-compatible query execution through PGlite. The full
legacy suite was compared against deployed commit ae5aaff: that baseline has
123 failing tests, largely older search/UI fixtures and catalogue counts. The
import-specific city-count assertion was corrected and the source-coverage count
was updated; all tests covering this import now pass. Existing unrelated legacy
failures were not changed by this data publication.
