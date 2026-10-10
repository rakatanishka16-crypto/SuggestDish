# Focused launch proposal — 10 October 2026

Status: provisional proposal, not an approved scope or readiness certification.

Recommend evaluating a Mumbai pilot first, selecting a small group of localities only after the recommendation-ready audit. This follows existing Mumbai-first research; it is not a claim that Mumbai has the highest eligible dish coverage. Jalna can be evaluated as a separate founder-led owner pilot when authorised owner access is available.

## Inspected evidence (batch counts, not city totals)
| Batch | Profiles | Menu entries | Priced entries | Limitation |
|---|---:|---:|---:|---|
| mumbai-2026-10-04 | 73 | 512 | 248 | Mixed Mumbai/Thane/Navi Mumbai; brand references and duplicated variants require audit |
| mumbai-dadar-food-data-2026-10-07 | 8 | 58 | 0 | No prices in this batch |
| kanjurmarg-simbly-dakshin-2026-10-07 | 1 | 33 | 33 | recommendation_eligible=false; branch_availability=not_confirmed; coordinates absent |
| jalna-district-open-data-2026-10-10 | 5 | 0 | 0 | Directory-only map observations, not Jalna city menus |

Do not add these overlapping batch counts into unique city totals. Existing licensed/delivery observations were inspected as repository evidence only; no delivery-platform scraping occurred.

## Proposed finite pilot gate (product targets, not existing counts)
- 20 distinct exact outlets across 2–3 selected Mumbai localities.
- 100 deduplicated outlet-linked dishes, with at least 60 priced observations carrying source and retrieval date.
- Evidence-based diet classification; unknown preparation excluded from strict Jain/vegan results.
- Actual source coordinates for each outlet used in radius recommendations; complete observed address and directions for all pilot outlets.
- Menu source tied to the branch, without converting brand references into current branch stock.
- No fabricated quality, popularity, hours, operation or owner-verification claims.
- Supported search constraints and empty-result/provider failure paths pass production tests.
These targets need founder acceptance and may be revised based on the audited supply.

## Next independent action
Task 3: obtain the per-city production menu-coverage response or reconstruct eligible counts from authorised database/runtime evidence, separate source menus from recommendation candidates, and identify locality gaps. Do not silently promote ineligible catalog entries.

## Access limits
The Vercel fetch connector failed at read_protection_bypass with HTTP 403 while resolving the production deployment aliases. This is a connector access failure, not proof that the public API itself returned 403. Public web retrieval also could not read /api/menu-coverage. Full live city comparison is pending; no unchanged bypass request was retried. Re-authorising the intended Vercel project/team may be needed if no permitted direct public fetch is available.

Source inspection was pinned to main commit 27d386c365852d7eeaa22bae85cd81d1ff775892. Documentation-only preparation; no runtime tests, database writes, live scope change or payment action.
