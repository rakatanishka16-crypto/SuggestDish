# Foodie improvements — 4 October 2026

All customer-facing content remains English. Preserve the existing visual identity. Never infer ingredients, dietary suitability, popularity, opening hours, prices or restaurant photos without evidence.

## Implemented and tested
- Explicit Vegetarian, Non-vegetarian and Any dietary type controls, including hard non-vegetarian filtering.
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
- Actual restaurant dish photographs, ingredient/diet evidence and permission to use each asset. Do not treat a generated image as an actual restaurant photograph.
- Durable media storage for owner uploads; confirm cost constraints before selecting a paid service.
- Verified hours, serving sizes, allergens, vegan/Jain availability, order/call URLs and current prices. Display unknown when unavailable.
- Monthly vs annual dish limits: current approved pricing stays unchanged until founder decides.
- Public support contact and legal business details; never fabricate them.
- Feedback and analytics records need database migrations and retention choices.

## Validation
48 automated tests pass after the first implementation batch. Live frontend controls confirmed; verify deployed vegetarian and non-vegetarian searches and saved shortlist separately. No claim that the complete audit backlog is finished.
