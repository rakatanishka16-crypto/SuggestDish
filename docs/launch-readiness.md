# Current launch status — 10 October 2026

This section supersedes historical deployment statements below. The historical notes remain as dated evidence, not current launch status.

- Audited main: `3eead37402ebd31be5173174a5e448e478cfb842`.
- Vercel project `suggest-dish`, production deployment `dpl_3ZxMA2Q9UAWuYd8FdCPM8LegUNTk`: READY, with `www.suggestdish.com` and `suggestdish.com` aliases confirmed on 10 October.
- Current runtime includes launch security, owner/review, feedback, media, analytics and Razorpay modules. Deployment confirms code delivery, not real owner, database or gateway acceptance.
- Earlier 10 October production API checks recorded 7,943 source profiles, 13,684 menu entries and 5,962 published price entries. These are source-catalog counts, not a restaurant census or a count of recommendation-ready dishes.
- Live charging remains paused by default in the server registration. Configured keys alone are not evidence that sandbox or live checkout passed.
- Outstanding: full production customer/mobile checks, authorised owner and moderation persistence, permitted reviewed images, legal/commercial facts, payment schema/sandbox acceptance, analytics persistence, monitoring/recovery and pilot testing.
- Authoritative ordered queue: [launch-task-progress.json](launch-task-progress.json). Task 1 completed; task 2 is next. State data coverage remains separately tracked in `api/source-batches/state-import-progress.json`.
- No runtime tests were rerun for this documentation-only reconciliation. No customer/owner submissions, payment, secret retrieval or database mutation was performed.

---

# Launch checklist — 4 October 2026

The checklist is implemented in the repository. This is not a claim that the updated version is live or that every provider integration has been verified.

| # | Check | Implementation / verification |
|---|---|---|
| 1 | Privacy page | `/privacy.html`; describes actual searches, providers, location, browser storage, submissions, feedback, optional analytics and request channel. |
| 2 | Terms page | `/terms.html`; discovery limitations, business review, acceptable use and paused checkout. Legal operator/contact details and any future payment/refund policy need owner confirmation before checkout resumes. |
| 3 | Secrets | Frontend scan found no API/database credentials. Server errors no longer expose provider details; diagnostics require private reviewer access in production. `.env.*` ignored. |
| 4 | HTTPS | Existing public HTTP request returns 308 to HTTPS; HSTS and upgrade-insecure-requests configured. |
| 5 | Consent controls | Reject/allow optional analytics with equal prominence; reopen in footer/privacy page. No analytics event sent before permission; browser privacy signals respected. |
| 6 | Titles/descriptions | Home, policies and existing business/admin pages have distinct metadata. Private tools marked noindex. |
| 7 | Social preview | 1200 × 630 local branded graphic, Open Graph and Twitter metadata. |
| 8 | Favicon | PNG and ICO derived from original logo. |
| 9 | Sitemap/robots | Three public pages in sitemap; API/private tools excluded from crawler discovery. Robots is not access protection. |
| 10 | Image alt text | Every static image has alt text; illustrative photos explicitly identified. Reviewed dish images retain the existing exact dish/diet checks. |
| 11 | Compress images | Local logo 62,289 → 9,188 bytes (85.2%); responsive image service requests reduced from 1200/q80 to 800/q65. Below-fold images lazy-loaded with dimensions. |
| 12 | Page speed | Byte reduction implemented. Browser load/Core Web Vitals measurement for the new deployment is pending; do not claim a Lighthouse score. |
| 13 | Contrast | Original palette retained; orange buttons use dark text and small orange text uses existing burgundy. Visible focus and reduced-motion support. |
| 14 | Mobile | Existing responsive layout retained; narrower heading, wrapping controls and navigation, bounded fields and consent banner added. Remote browser cannot open localhost; visual checks of the new deployment pending. |
| 15 | 404 | Branded `404.html` with recovery links and noindex; actual missing-route response requires deployment verification. |
| 16 | Broken links | Local files and anchors checked, zero broken local references. Published Instagram, Geoapify and OpenStreetMap links also returned HTTP 200. Source links can change. |
| 17 | Validation | Existing form/backend checks retained; invalid explicit budgets rejected, preference fields bounded. |
| 18 | Spam protection | Existing listing honeypot retained. API request limits added, with protected diagnostics, explicit CORS origins and retry headers. Per-instance memory limits are not a shared distributed quota; provider webhook keeps its existing signature verification. |
| 19 | Analytics | Existing anonymous dish/day event counting is now permission-gated. Counts are events, never unique people/orders. No additional paid tracking service introduced. Live database event persistence remains unverified. |
| 20 | Clear CTA | Primary hero action `Find My Dish` points to recommendation inputs; location is optional. |

## Validation
75 Node tests pass, including HTTP integration checks for origin restrictions, diagnostics and rate limits, and consent tests for rejection, changes, privacy signals and unavailable storage. JavaScript syntax and local link/alt checks pass. No real business claims, feedback or payments submitted for testing.

## Deployment
The review deployment for commit 9646c5179ed686ac979fd436b3f3436ff8ed99b7 reached READY (dpl_5xbg4WfJaEqHsbGp4dcXGanCnotQ). The earlier build-rate-limit failure did not block this preview. Protected preview fetch was denied by Vercel with 403 (read_protection_bypass), so policy responses, custom 404, security headers, mobile rendering and load metrics remain unverified on the new deployment. Automatic approval review rejected merging PR #21 into main because explicit merge authorisation is required. The PR remains open; production has not been changed. No paid upgrade or protection change was performed.

## Operational limits
Policies describe current implementation and do not certify legal compliance. Terms do not invent a legal entity, dedicated email address, refund promise or subscription process. Contact uses the already-published @suggestdish.ai channel. Precise data retention automation has not been added. Production database and Gemini/Geoapify credentials remain in provider settings; they were not retrieved or embedded in the changes.