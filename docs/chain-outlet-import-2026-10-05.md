# Chain outlet import — 5 October 2026

This import adds actual outlet observations to the existing city restaurant directory. It does not add more franchise-model cards.

- Domino’s Pizza: 2,355 outlet records. Current city-store responses replace the older locator cards for the cities where a nonempty current response was collected. Those responses supply store IDs, addresses, phones and source coordinates. Other cities retain the official locator’s cards and unconfirmed operating status.
- KFC: 135 Maharashtra outlet records, with menus read from the individual official outlet pages.
- Burger King: 101 Maharashtra outlet records. The pages checked do not supply transcribable dish prices, so no priced menu is inferred.

Jalna includes Domino’s Shakun Plaza, source store ID 64037, with its official address, phone, source map pin and published hours. The national Domino’s menu has 661 size/crust variants and 38 combos. It is attached as reference information, with no claim that each item or price applies at Jalna or any other outlet. The public ordering site was blocked during the check, so local stock and the final Jalna bill remain unconfirmed.

KFC’s 97 published menu entries are associated only with outlet pages actually checked. Identical menu sets are stored once; each API response substitutes the selected outlet’s URL and source key. The data model prevents a reference menu from being converted into outlet-specific evidence. Dietary type stays unknown unless the source explicitly labels it. GST exclusions are shown only where stated by the source.

The directory now filters by the outlet’s city, rather than any occurrence in an address. This prevents Aurangabad’s Jalna Road from masquerading as Jalna. A nearby map candidate with an exact chain name can be enriched with its official source profile, using a small coordinate tolerance. These matches are directory enrichment, not ownership verification.

Unknown street addresses, states, coordinates, licences, ratings and menu facts remain unfilled. Source city labels include aliases and typos; their count is not an independently verified count of municipalities. Known Bangalore/Bengaluru and Gurgaon/Gurugram aliases are normalized while retaining the source label. This is a finite source snapshot, not complete coverage of every outlet, franchise or city in India.

## Storage and verification

The snapshot is `api/source-batches/chain-outlets-2026-10-05.json.gz`, a gzip-compressed UTF-8 JSON file. It is explicitly included in the Vercel API function. `lib/chain-source-catalog.js` reads the fixed file path and resolves menu associations. Directory queries combine it with the existing Neon restaurant/candidate records; this import does not insert unconfirmed national menu prices into the Neon Dish table or the recommendation pool.

The homepage keeps the existing design and opens details in the existing restaurant directory. `/?outletCity=Jalna&outletName=Domino#business-directory` opens the relevant city search. No secrets, ratings, social-media reviews or franchise ownership claims are included.

The collector and builder are in `scripts/collect-chain-outlets.py` and `scripts/build-chain-source-batch.py`. They use BeautifulSoup/lxml and a cache directory. Start a new cache directory for any future source check; cached responses are historical evidence and must not be relabelled with a new retrieval date. The collector uses two workers, short pacing and a fixed request deadline. It makes no authenticated requests and does not bypass site blocks.

To inspect the snapshot: `gzip -dc api/source-batches/chain-outlets-2026-10-05.json.gz`.
