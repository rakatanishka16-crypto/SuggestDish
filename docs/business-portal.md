# Business portal and private review

Owners use the reference and private access code returned by a new listing to check its status at /#business-checkout. Pending or needs-information submissions can correct their signature dish, price, diet and menu source. Corrections stay pending; they never change live Dish records. Approved/rejected submissions cannot be edited through this endpoint. Older submissions without access codes require a trusted ownership check and private code issuance; never expose existing hashes.

The private review page is /admin-review.html. Queue and decision APIs are unavailable until BUSINESS_REVIEW_KEY (a securely generated secret at least 32 characters long) is saved in Vercel Production and redeployed. Enter it directly into the page; it stays in memory and is never stored in browser storage. Do not share it with restaurant owners. This is a founder-only initial review tool, not a multi-user login system. Existing Neon review remains available without this setting.

Reviewer independently checks profile identity, owner authority, price and diet. The page opens source links but does not scrape or automatically verify ownership. Approval calls the existing transactional approve_business_submission function; conflicts fail instead of overwriting dishes. Review notes are private. Business contacts remain in Neon for independent checks. Needs-information status is visible to the owner; follow up using verified contacts outside this tool. No automatic emails are sent.

Approvals insert the reviewed signature dish into the existing recommendation database. Existing curated menus are preserved. New restaurants still need source-verified coordinates for distance-based results. City-based searches can use approved city records. Never infer coordinates from an owner assertion without checking them.

Paid checkout is paused by default in the billing module, even if Razorpay credentials are present. The existing payment verifier and ledger are preserved. Re-enable only after an explicit founder request and integration verification. No new schema migration is required for this release.
