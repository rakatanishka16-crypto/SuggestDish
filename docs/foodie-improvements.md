# Foodie improvements — 4 October 2026

All customer-facing content remains English. Preserve the existing visual identity. Never infer ingredients, dietary suitability, popularity, opening hours, prices or restaurant photos without evidence.

## Implemented and tested
- Explicit Vegetarian, Non-vegetarian and Any dietary type controls, including hard non-vegetarian filtering.
- Explicit requested dish families/proteins are hard constraints; unavailable sandwiches cannot be silently replaced by biryani.
- Exact dish and dietary evidence required for photos for every dietary type. No generic image search. Production reviewed photo catalog is currently empty.
- Distinct restaurant-brand candidates instead of repeated branch recommendations.
- Configurable nearby distance, validated on the server.
- Lower per-dish budgets and custom amount.
- Concrete fallback reasons containing dietary type, budget and available distance.
- Google Maps search links, WhatsApp sharing and device-local saving.
- Device-local shortlist viewing and removal.
- Unsupported example popularity/rating claims removed.

## Next independent implementation work
- Inline locality entry and persistent selected-location indicator.
- Quick craving chips, natural-language search entry and aliases.
- Preference memory with an explicit user choice; clear/reset control.
- Cheaper/closer/different result refinements and no-results recovery.
- Mobile navigation, form accessibility and complete phone-sized flow testing.
- Verified source links and freshness dates where the existing data actually provides them.
- Clear coverage indicators and recommendation-ready vs directory-only distinction.
- Customer correction reports and dish-specific feedback with moderation.
- Owner dashboard and simple review statuses.
- Photo/menu upload workflow with protected ownership and moderation.
- Verified badges and clear sponsored labels when those features are backed by evidence.
- About, contact and source/correction processes using verified business details.

## Data or product decisions needed
- Founder selected placeholder when a verified matching photograph is unavailable. Collect actual restaurant photographs, ingredient/diet evidence and permission before populating media. Never substitute an illustration.
- Durable media storage for owner uploads; confirm cost constraints before selecting a paid service.
- Verified hours, serving sizes, allergens, vegan/Jain availability, order/call URLs and current prices. Display unknown when unavailable.
- Founder confirmed annual plan remains ₹4,999 for 2 dishes. Monthly remains ₹499 for 3 dishes.
- Public support contact and legal business details; never fabricate them.
- Feedback and analytics records need database migrations and retention choices.

## Validation
49 automated tests pass after the first implementation batch. Live frontend controls confirmed; verify deployed vegetarian and non-vegetarian searches and saved shortlist separately. No claim that the complete audit backlog is finished.

## Original 45-item audit checklist

Done means the specified behavior is implemented. Partial means more work/data is required; it is not counted as finished.

| # | Original audit item | Status | Remaining work or evidence |
|---|---|---|---|
| 1 | Diverse restaurant brands | Done | Brand suffix grouping; do not pad missing choices |
| 2 | Nearby distance choices | Partial | Radius works; delivery mode still pending |
| 3 | Verified vegetarian photos | Partial | Safe placeholder works; reviewed assets needed |
| 4 | Specific recommendation reasons | Partial | Budget/diet/distance reasons; stronger dish evidence needed |
| 5 | Verified star vs menu labels | Partial | Evidence labels exist; stronger card badges pending |
| 6 | Directions/menu/call/order actions | Partial | Maps and source links; verified call/order URLs needed |
| 7 | Smaller and custom budgets | Done | ₹50/100/150 and custom amount |
| 8 | Inline locality entry | Partial | Field, city suggestions, visible selected location; full locality autocomplete pending |
| 9 | Foodie-first navigation | Done | Four primary links; businesses retain dedicated entry |
| 10 | Honest example popularity claims | Done | Unsupported Popular/Highly rated example claims removed |
| 11 | Saved shortlist | Done | Device-local save, view and remove |
| 12 | Understandable plan limits | Done | Founder reconfirmed annual two vs monthly three; terms explicit |
| 13 | No-login first search | Done | Public recommendation flow |
| 14 | Natural-language entry | Done | Entry precedes filters; supported budget/diet/dish constraints |
| 15 | Quick craving chips | Done | Breakfast, street food, sweet and light; diet preserved |
| 16 | Veg/non-veg/vegan/Jain selection | Partial | Veg/non-veg/any; verified vegan/Jain signals needed |
| 17 | Dietary evidence states | Partial | Unknown cautions; verified ingredients still needed |
| 18 | Delivery/dine-in/takeaway mode | Queued | Reliable mode-specific evidence needed for ranking |
| 19 | Per-dish budget meaning | Done | Explicit label and fees disclaimer |
| 20 | Portion and serves | Data needed | Never infer serving sizes |
| 21 | Spice level and customisation | Data needed | Verified restaurant information |
| 22 | Verified opening hours | Data needed | Current source and freshness |
| 23 | Price/source freshness | Partial | Source-check date if available; price confirmation explicitly unknown |
| 24 | Dish evidence vs restaurant rating | Partial | Do not fabricate dish ratings; more evidence display pending |
| 25 | Accurate photo label | Done | Matching reviewed media only; actual vs representative contract |
| 26 | Recommendation refinements | Partial | Cheaper, closer, different and reset; evidence-based less-spicy pending |
| 27 | Dislike reasons | Partial | Form and moderated backend added; live persistence needs verification |
| 28 | Empty-result recovery | Done | Edit request or explicitly expand distance; constraints preserved |
| 29 | Hindi/Hinglish search | Partial | Selected Hindi aliases only; full preference understanding pending |
| 30 | Local dish aliases | Done | Golgappa/panipuri/puchka, khichdi and selected Hindi names |
| 31 | WhatsApp sharing | Done | User-initiated share links |
| 32 | Preference memory | Done | Opt-in on-device persistence and forget; precise location excluded |
| 33 | Tried-it feedback | Partial | Tried-it assertion, optional ratings, private moderation; persistence needs live verification |
| 34 | Correction reports | Partial | Bounded reports and private review; persistence needs live verification |
| 35 | Mobile usability | Partial | Focus/touch/overflow improvements; full phone verification pending |
| 36 | Sponsored labels | Queued | No payment-based ranking introduced |
| 37 | Paid listings respect constraints | Partial | Existing budget/diet filtering retained; full sponsorship tests pending |
| 38 | Directory vs menu readiness | Done | Visible distinction and partial coverage copy |
| 39 | Owner menu/photo upload | Queued | Reviewed ownership and durable storage |
| 40 | Submission status journey | Done | Dashboard and claim status show explicit review stages |
| 41 | Verified ownership and controlled edits | Partial | Protected claims exist; badge display pending |
| 42 | Owner dashboard | Partial | Hub and protected submission lookup added; direct media/profile editing pending |
| 43 | Actual performance metrics | Queued | Event collection and reporting; never call clicks orders |
| 44 | About/contact/privacy/corrections | Partial | About, data flow and approved Instagram support added; legal business details not supplied |
| 45 | Honest source coverage | Partial | City-level priced menu counts added; locality counts not available |

Batch two implements ten improvements associated with items 8, 9, 14, 15, 23, 26, 28, 30, 32 and 38. Partial audit items remain partial. Automated tests: 55 pass before publishing this batch.

## Batch three
Implemented customer dislike reasons, tried-it feedback, correction reports, protected moderation, dining-mode selection with unverified-suitability disclosure, evidence/unknown-fact cards, review-status progress, business dashboard, approved Instagram support/privacy copy, and city-level priced-menu counts. Vegan/Jain requests explicitly require verified preparation and otherwise return no match. Sponsored badge rendering is reserved for explicit sponsored records; no paid placement is introduced.

CustomerFeedback is an additive table created lazily by the protected moderation queue or a valid customer submission. Local tests verify validation, bound SQL, duplicate handling, unavailable storage, missing/wrong reviewer keys and moderation boundaries. It does not edit Dish records or publish customer ratings. Runtime database persistence is pending verification; do not claim it has been verified merely because mock tests pass. No public fabricated feedback is submitted for testing.
