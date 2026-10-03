# Business listing review

Owners submit at /#list-business. POST /api/business-listings saves to public."BusinessSubmission" with pending status. There is no public endpoint that reads submissions or approves them.

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
