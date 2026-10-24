# Business listing publication

New food-business submissions publish immediately after basic field validation and publication consent. A website or public business/social profile plus a menu link (or confirmation that the menu is posted on that profile) is required. The form includes home bakers, catering, hotels, restaurants, cafes, cloud kitchens and other food outlets.

`lib/self-published-business.js` atomically creates a Restaurant, one Dish and its BusinessSubmission. The existing schema status remains `pending` for compatibility, with `verificationNotes=owner_self_published_v1`; APIs present this as `published`. This is an owner declaration, not independently verified ownership, menu evidence, popularity or a paid entitlement. No review, recurring payment or verification badge is granted.

The public directory includes the saved category and menu link. New entries stay editable with their reference and private access code. An authenticated update can also publish an older, unlinked pending submission after the owner confirms publication consent. Existing reviewed/claimed business records are not overwritten. Legacy submissions are not bulk-published without the owner's new publication consent.

New form consent authorises public business identity, service area/address, profile/menu and dish details. Contact name, email, phone and credentials remain private. Home businesses should supply a public service area instead of a private home address. Menu prices and dietary labels are owner-supplied; recommendations label this explicitly. Missing coordinates exclude distance-filtered searches.

The private moderation endpoints remain available for reports, corrections and takedowns after publication. Self-published entries are excluded from the pre-publication queue. Set a self-published submission to `rejected` or `needs_information` to hide its owner listing and menu recommendations. Separate independent claims, badges and uploaded-photo permissions keep their existing checks.

## Validation

Run the listing, owner, directory, review, status and evidence tests. The full database path was additionally checked against embedded PostgreSQL (PGlite): publish, directory/category lookup, stored dish, private status, live update, duplicate rollback, rejection, and authenticated legacy publication. No production fixture or live customer record is needed for these checks.

In Neon → production → neondb → SQL Editor, review the queue:

```sql
SELECT * FROM public."BusinessSubmission"
WHERE status='pending' ORDER BY "createdAt";
```

Check the supplied Google Maps/Zomato profile against the business name, full address and city. Confirm the submitter's authority independently through an official business contact; a profile URL alone is not ownership proof. Check the signature dish name, current price and vegetarian status against the official menu. If a source is unavailable or inconsistent, request more information instead of approving. Never fabricate reviews, ratings or coordinates. Contact details are private review data.

Only after those checks, a reviewer with existing Neon access can publish with:

```sql
SELECT public.approve_business_submission(
  'submission-reference-here'::uuid,
  'https://official-menu-or-verified-profile-source',
  'Describe the profile, ownership and menu checks, reviewer and date'
);
```

The function atomically adds or links the restaurant, adds the reviewed signature dish and source, and marks the submission approved. It refuses conflicting existing dish price/diet values. It is idempotent for already-approved submissions. Correct submitted fields in the private queue after source review before approval if needed. No payment or sponsorship is granted by approval.

For incomplete or invalid submissions, set status to needs_information or rejected and record verificationNotes and reviewedAt. Do not add them to Restaurant/Dish. There are no automatic notifications or automatic Google/Zomato verification in this version.
