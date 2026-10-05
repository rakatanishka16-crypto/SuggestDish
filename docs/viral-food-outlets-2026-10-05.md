# Viral-food outlet additions

Adds 41 actual locations from three official business websites: 23 Kunafa World locator entries, 17 Kunafa Bytes entries, and Cafe 9 Story at C101 Pragati IT Park, Mota Varachha, Surat. Addresses, business phone numbers and source dates are preserved. Missing pins, dietary preparation, ratings, licences and live inventory remain unknown.

22 branches have Google listing links published by the business (4 Kunafa World, 17 Kunafa Bytes, 1 Cafe 9 Story). The UI labels these explicitly as business-published links. Google listing contents could not be independently fetched; no Google reviews, ratings or hours were scraped or inferred. Other official locator entries have no independently checked Google status.

Cafe 9 Story has 26 priced food-menu entries from its single-location official menu, including Biscoff Cheesecake ₹310, peri-peri fries ₹200 and Korean-style noodle dishes ₹270. Its menu is attached only to that Surat outlet. Kunafa World's eight product names and Kunafa Bytes' Kunafa Chocolate are brand references with no local price or stock claim.

Kunafa Bytes' Cannought Garden/Cidco location is searchable under Aurangabad and retains Chhatrapati Sambhajinagar in its address. The Adajan entry is withheld because its published address duplicates South Bopal, Ahmedabad. KBites is withheld because only a head-office address was established. The full curated top-100 dish list has not been mapped to individual branches; these additions cover a source-backed subset.

Sources: https://www.kunafaworld.com/store_locator.php, https://www.kunafaworld.com/index.php, https://kunafabytes.com/store-locator/, https://cafe9story.com/en/menu. Collected through indexed official-page observations on 5 October 2026. Browser collection timed out; source Google links could be resolved but listing contents were inaccessible.

The builder takes the exported, line-numbered Kunafa World locator text as `--world-source` and writes a deterministic gzip with `--output`. Kunafa Bytes and Cafe 9 Story observations are recorded in the builder. No checkout, recommendation or owner-verified table changes are made.
