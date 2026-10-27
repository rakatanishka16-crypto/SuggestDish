# Jalna requested outlet menus — 27 October 2026

The user requested priced menus for 64 identified Zomato listings. This batch publishes **35 outlet menus with 2,171 exact-price dish entries** through the IndiaRestros public API. The other 29 requests remain pending: 8 have unresolved outlet/address identity and 21 lack an exact requested-outlet menu in the permitted API responses.

The provider permits commercial API use (https://indiarestros.com/terms); its API reference documents source-dated menus and 120 read requests per minute (https://indiarestros.com/api/docs). The collector accesses IndiaRestros endpoints only, rate-limited below that threshold. Each menu item retains the provider menu URL, upstream platform URL, upstream update timestamp and retrieval date. No photos, descriptions, reviews, ratings or contacts are republished. Prices and current availability are not independently verified.

Only positive finite numeric prices up to ₹100,000 are included. Conflicting duplicate prices/diet flags are held; identical duplicates are collapsed. Dietary flags are retained only where explicitly returned. An exact requested upstream outlet URL is mandatory: same-name branches, national chain menus and mismatched source menus do not qualify. Previously held identity conflicts remain held.

The immutable snapshot enriches the existing source catalogue. Directory cards show up to three priced dishes, with the full searchable menu under **Business details & menu**. Existing restaurant/dish database rows, owner-submitted details and stronger source identity facts are preserved. These third-party menu observations are not silently promoted into recommendation dishes. No production database write or migration is needed. Menu items are indexed by outlet once during catalogue loading, avoiding repeated full-menu scans as the dataset grows.

## Validation

Three Python builder checks and 37 targeted Node checks cover exact branch matching, valid prices, duplicate conflicts, provenance, protected owner identity, directory filtering, full-menu responses and PostgreSQL-compatible pagination. Live release verification is performed after deployment.

## Outcome for each requested listing

| Requested listing | Outcome | Priced dishes / reason |
|---|---|---|
| 7 Spices | Published menu | 165 |
| Anandi Veg | Published menu | 91 |
| Atithi Veg | Held | Confirm the exact branch/address before linking its menu. |
| Amber Hotel | Held | Confirm the exact branch/address before linking its menu. |
| Mohan Sunrise Family Restaurants | Pending | An exact outlet menu with prices is needed. |
| Hotel Madhuban | Published menu | 24 |
| Myra Restro | Published menu | 357 |
| Saawariya - Radha Rani Ki Rasoi | Published menu | 110 |
| Rasoi Pure Veg Restaurants | Published menu | 87 |
| Vaishnavi Pure Veg | Published menu | 191 |
| Maharaja Restaurant Pure Veg | Published menu | 25 |
| Hotel Yashwant Dhaba | Pending | An exact outlet menu with prices is needed. |
| Kaka Ka Dhaba | Pending | An exact outlet menu with prices is needed. |
| Biryani & More | Pending | An exact outlet menu with prices is needed. |
| Hotel Maratha Matan Bhakari | Pending | An exact outlet menu with prices is needed. |
| Shree Gajanan Bojanalay | Held | Confirm the exact branch/address before linking its menu. |
| Hotel Basra | Published menu | 22 |
| Food Central | Published menu | 45 |
| Cafe Blush | Held | Confirm the exact branch/address before linking its menu. |
| Hidden Coffee Cafe | Published menu | 97 |
| Foody Frnds Cafe | Published menu | 14 |
| Stock Cafe | Pending | An exact outlet menu with prices is needed. |
| Fast N Food | Published menu | 24 |
| Hot Cup Vibes | Published menu | 47 |
| Mad Over Pizza | Published menu | 144 |
| Sony Pizza Centre | Pending | An exact outlet menu with prices is needed. |
| Graduates Kitchen | Pending | An exact outlet menu with prices is needed. |
| The Pizza Mania Hub - Pure Veg | Pending | An exact outlet menu with prices is needed. |
| Appe Wale | Published menu | 14 |
| Anna Dosa Center | Published menu | 12 |
| Annapurna Dosa'j | Held | Confirm the exact branch/address before linking its menu. |
| Naadbramha Idli - APMC Market | Pending | An exact outlet menu with prices is needed. |
| Naadbramha Idli - Shivaji Putla Road | Held | Confirm the exact branch/address before linking its menu. |
| Ekta Nashta Corner | Published menu | 6 |
| Shambho Nashta & Tea Center | Published menu | 7 |
| Goli Vada Pav No. 1 | Pending | An exact outlet menu with prices is needed. |
| Jain Bandhu Pav Bhaji Centre | Held | Confirm the exact branch/address before linking its menu. |
| Pappu Pav Bhaji & Juice Centre | Published menu | 16 |
| Panchvati Pav Bhaji Juice And Veg Chinese Corner | Published menu | 88 |
| Best Pavbhaji Corner | Published menu | 46 |
| The Pav Bhaji Express | Pending | An exact outlet menu with prices is needed. |
| Momo's N More | Published menu | 18 |
| Momo Ghar And Wrap | Published menu | 110 |
| Moh Maya Momos | Pending | An exact outlet menu with prices is needed. |
| House Of Momos - Pure Veg | Published menu | 33 |
| Vishal Chinese | Published menu | 41 |
| Picknik Bakery | Pending | An exact outlet menu with prices is needed. |
| Vaishnavi Bake & Cake | Published menu | 21 |
| Mr. Bakery Wala | Pending | An exact outlet menu with prices is needed. |
| Apna Cake Shop | Published menu | 7 |
| Cake Orbit | Pending | An exact outlet menu with prices is needed. |
| Cake House By Pooja | Pending | An exact outlet menu with prices is needed. |
| Cake Addict | Published menu | 26 |
| Abhi Cake House | Pending | An exact outlet menu with prices is needed. |
| Om Milan Mithai | Published menu | 66 |
| Shri Krishna Mithai Bhandar | Pending | An exact outlet menu with prices is needed. |
| Shiv Samrat Bikaner Sweets Mart By Gajre Bandhu | Published menu | 11 |
| Vrindavan Sweets And Farsan | Published menu | 22 |
| Shree Bharkadevi Icecream | Pending | An exact outlet menu with prices is needed. |
| New Mahalaxmi Ice Cream & Kulfi Center | Published menu | 29 |
| De Roma Ice Cream | Published menu | 36 |
| Frullato | Held | Confirm the exact branch/address before linking its menu. |
| The Waffle House | Pending | An exact outlet menu with prices is needed. |
| Frozen Bottle - Milkshakes, Desserts And Ice Cream | Published menu | 119 |
