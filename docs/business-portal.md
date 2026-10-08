# Business portal and private review

Owners use the reference and private access code returned by a new listing to check its status at /#business-checkout. Pending or needs-information submissions can correct their signature dish, price, diet and menu source. Corrections stay pending; they never change live Dish records. Approved/rejected submissions cannot be edited through this endpoint. Older submissions without access codes require a trusted ownership check and private code issuance; never expose existing hashes.

The private review page is /admin-review.html. Queue and decision APIs are unavailable until BUSINESS_REVIEW_KEY (a securely generated secret at least 32 characters long) is saved in Vercel Production and redeployed. Enter it directly into the page; it stays in memory and is never stored in browser storage. Do not share it with restaurant owners. This is a founder-only initial review tool, not a multi-user login system. Existing Neon review remains available without this setting.

Reviewer independently checks profile identity, owner authority, price and diet. The page opens source links but does not scrape or automatically verify ownership. Approval calls the existing transactional approve_business_submission function; conflicts fail instead of overwriting dishes. Review notes are private. Submitted business contacts can be loaded individually in the private review page for independent checks. Needs-information status is visible to the owner; follow up using verified contacts outside this tool. No automatic emails are sent.

Approvals insert the reviewed signature dish into the existing recommendation database. Existing curated menus are preserved. New restaurants still need source-verified coordinates for distance-based results. City-based searches can use approved city records. Never infer coordinates from an owner assertion without checking them.

Paid checkout is paused by default in the billing module, even if Razorpay credentials are present. The existing payment verifier and ledger are preserved. Re-enable only after an explicit founder request and integration verification. No new schema migration is required for this release.

## Ownership evidence options — 8 October 2026

Directory ownership claims and pending-claim corrections accept HTTPS official business websites and public business profiles, including Google, Zomato, Instagram and Facebook. URLs are stored for private manual review, not fetched or treated as ownership proof. Public GST registration details may be cited in the existing private ownership-evidence text; no GST verification service or document upload is implemented. Never submit passwords or identity documents. Identity, branch address and submitter authority still require independent review. The new-business listing and reviewer evidence URL fields now accept the same HTTPS website/profile formats, as documented below.

The existing production spelling BUSINESS_REVEIW_KEY is supported as a compatibility fallback. BUSINESS_REVIEW_KEY takes precedence, even when empty; both require at least 32 characters. No key value is returned to clients.

## Reload pending claim details — 8 October 2026

On claim-business.html, enter the claim reference and private code, then choose Load saved details for correction. This deliberately replaces the correction form fields with the authenticated owner’s saved city, address, profile link, ownership evidence and latest slot-one dish. Consent resets and must be confirmed again. The endpoint is read-only and refuses approved/rejected claims. It never returns contact details, reviewer notes or token hashes. Corrections still require owner credentials and remain pending; loading details does not change live menus. Real-owner persistence remains to be verified with an actual authorised owner; no fabricated claim is submitted to production.

## Private submitted-contact lookup — 8 October 2026

Pending listing and ownership-claim cards offer Show submitted contact details, requiring the private reviewer key. Read-only endpoints select name, email and phone for one pending/needs-information reference, not the whole queue. Submitted contacts remain unverified and must be compared with an independent official business source before confirming authority. No messages are sent, no contacts are made public, and no token hashes or reviewer notes are returned. Changing the reviewer key clears loaded cards and discards responses from the previous key; Hide removes the contact block. Real authenticated production contact retrieval remains unverified without the reviewer’s private key.

## Official-source directory handoff — 8 October 2026

Official-source directory cards now carry the stable sourceBusinessId to the new-business review form. The browser retrieves that exact catalog identity and offers Use selected outlet details. Only a deliberate click replaces name, city and address; missing facts stay blank. Prior category, profile, menu, dish, price, diet and consent are cleared, while owner contact inputs remain. No automatic submission, ownership approval, price or diet inference is performed. Official-only source records still use the new-business review route rather than the existing Neon-backed ownership-claim route.

## Consistent new-business evidence — 8 October 2026

New-business submissions, pending dish corrections and private approval evidence now use the same bounded HTTPS URL validator as ownership claims. Official websites and Instagram/Facebook business profiles can be submitted alongside Google/Zomato profiles. URL syntax is validated, not business identity or ownership. URLs are not fetched automatically. Review still requires independent owner, exact branch, menu-price and dietary checks, explicit reviewer confirmation and private notes. No automatic approval or database migration is introduced.
