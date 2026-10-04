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
