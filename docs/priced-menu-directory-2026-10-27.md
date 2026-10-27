# Directory visibility requires menus and prices

At the user's request, public browsing now includes only businesses with at
least one actual priced menu item. Data without menus/prices remains archived;
no source records or existing dishes are permanently deleted.

Source-catalogue profiles qualify only when the menu is outlet-specific
(`outlet_page` or `outlet_observed`) and at least one item has a positive finite
price, an exact branch association and an HTTPS source. Conflicting prices,
ambiguous ranges, directory links alone and national brand references do not
qualify. Dietary labels are not guessed and are not prerequisites for browsing.

Existing database businesses and owner listings remain eligible when their Dish
rows have positive finite prices. Existing curated menu records need not gain a
new external URL to stay visible. Source/owner verification remains separate.

All new registry-only profiles therefore disappear from public browsing, while
the FSSAI batch and audit remain intact. The archived national catalogue has 205
qualifying outlet-menu source profiles. In addition, existing database menus are
filtered in SQL before pagination and totals. These sets can overlap and must
not be added to infer a distinct venue count. The production database check
found 32 Jalna businesses with priced dish records before this release.

Directory cards show up to three priced menu items, and source-backed listings
link directly to the priced menu source. The menu and data-coverage wording now
explains this visibility rule. Dish recommendations, saved dishes and owner
management remain unchanged.
