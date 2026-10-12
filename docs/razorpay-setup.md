# Razorpay Standard Checkout in SuggestDish

## Existing integration

SuggestDish uses Node.js/Express with CommonJS, an HTML/JavaScript frontend, Neon PostgreSQL, and Vercel. The existing integration calls Razorpay's REST API with native fetch; no additional Razorpay SDK is required.

- POST /api/billing/orders: creates a server-priced order for an approved business.
- POST /api/billing/verify: validates the returned order ID, payment ID and HMAC-SHA256 signature using the stored order ID; fetches the payment to check amount, INR currency, merchant key and captured state.
- POST /api/billing/status: reconciles interrupted confirmations.
- POST /api/razorpay-webhook: verifies the signature over the exact raw request body and reconciles payment/refund events.
- GET /api/billing/config: reports availability and test/live mode without exposing secrets.

index.html already loads https://checkout.razorpay.com/v1/checkout.js on demand, opens the checkout modal with the server's order ID, sends all three returned proof fields to verification, and handles dismissal and payment.failed.

Monthly: 49900 paise (₹499), capacity 3 dishes for one calendar month. Annual: 499900 paise (₹4,999), capacity 2 dishes for one calendar year. These are existing prices, not a new pricing decision. Amounts come from the server; client amounts are ignored. Each purchase is for a single period, with no automatic renewal.

## Local setup — VS Code

1. Open the actual SuggestDish project folder in VS Code.
2. In VS Code's integrated Terminal, run npm install to install the project's existing dependencies.
3. Copy .env.example to .env. Enter the correct private values in the .env editor, not an AI chat. Existing .env values should be retained; do not overwrite an existing file with the template.
4. Local startup needs DATABASE_URL and GEMINI_API_KEY. Use a separate test database for payment testing.
5. Set all four RAZORPAY_TEST_* variables, including RAZORPAY_TEST_ENABLED=true, only in the intended test environment.
6. Run node scripts/check-payment-readiness.js. This reads database schema metadata without applying migrations or creating orders.
7. Run npm start. Open http://localhost:3000 in a browser.
8. Run node --test tests/razorpay-payments.test.js tests/payment-readiness.test.js for mocked API and readiness regression tests.

.env and .env.* are ignored by Git; .env.example contains blank secrets and is deliberately tracked. Never copy credentials into index.html or frontend JavaScript. This project does not need NEXT_PUBLIC_, VITE_ or REACT_APP_ variables.

## Hosted test setup — Vercel and Razorpay

In Vercel → the project serving suggestdish.com → Settings → Environment Variables, save the following for the intended Preview deployment:

| Name | Value |
|---|---|
| RAZORPAY_TEST_ENABLED | true |
| RAZORPAY_TEST_KEY_ID | Your Razorpay Test Mode key ID starting rzp_test_ |
| RAZORPAY_TEST_KEY_SECRET | The matching Test Mode secret |
| RAZORPAY_TEST_WEBHOOK_SECRET | A private webhook secret you choose |

Preview also needs its own DATABASE_URL and Gemini configuration. Do not copy the production database into Preview just to make a test pass. Verify which database the preview uses before preparing payment records.

Redeploy the intended preview after changing variables. Its /api/billing/config should report available:true and mode:test. This confirms configuration presence and format only; it does not establish valid gateway credentials or database readiness.

In Razorpay Dashboard → Test Mode → Account & Settings → Webhooks, append /api/razorpay-webhook to the actual reachable HTTPS test deployment URL. Use the same test webhook secret and subscribe to payment.captured, order.paid and refund.processed. Deployment protection may prevent webhook delivery: have the developer establish an appropriate test endpoint before saving the webhook. Configure automatic capture.

An approved authorised business submission and its private access code are required to open checkout. Missing references, secrets, database prerequisites or webhook reachability must be resolved before an actual test payment.

## Acceptance checks

Test the checkout modal, cancellation, failure, captured payment, authorised-but-uncaptured payment, mismatched signature, amount/currency tampering, duplicate webhook delivery and refund handling. Verify duplicate/refund behavior against the real test database, not only mocked SQL. Test payments must not activate production dish allowances.

## Live activation remains a separate step

The server currently registers the payment module with paymentsPaused=true by default. Setting RAZORPAY_ENABLED=true alone does not enable live checkout. A reviewed code change to the server registration is required after sandbox acceptance, merchant activation and commercial-policy checks.

Live mode then uses RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET and RAZORPAY_ENABLED=true, with RAZORPAY_TEST_ENABLED=false. Configure the live webhook for https://www.suggestdish.com/api/razorpay-webhook and redeploy. Setting RAZORPAY_ENABLED=false pauses new live checkout after redeployment.

No real credentials, real charges, database migrations or live activation are included in this change.

Official reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/
