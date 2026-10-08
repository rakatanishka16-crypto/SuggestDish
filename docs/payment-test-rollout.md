# SuggestDish payment test rollout

Prepared 2026-10-08. Real charges remain paused by default.

## Configuration in Vercel

In the SuggestDish project's Settings → Environment Variables, configure these dedicated sandbox variables in the intended deployment environment:

- `RAZORPAY_TEST_ENABLED=true`
- `RAZORPAY_TEST_KEY_ID`: Razorpay Test Mode key ID, starting `rzp_test_`.
- `RAZORPAY_TEST_KEY_SECRET`: corresponding secret, entered directly in Vercel.
- `RAZORPAY_TEST_WEBHOOK_SECRET`: the secret chosen for the Razorpay Test Mode webhook.

Do not paste secrets into chat, code or documentation. These variables do not overwrite existing live credentials. A live key in the sandbox key field fails closed. Redeploy after configuration.

In Razorpay Dashboard Test Mode, configure the HTTPS webhook endpoint `https://www.suggestdish.com/api/razorpay-webhook` for `payment.captured`, `order.paid` and `refund.processed`. Set the webhook secret to the same dedicated test webhook secret.

## Readiness checks before checkout

Confirm that `migrations/razorpay-payments.sql` has been applied to the intended database: BusinessPlanPayment, reserve_business_payment and confirm_business_payment must exist. Do not run migrations against an unidentified database. No database migration was applied during this code change.

An approved real business submission and its private access code are required. `/api/billing/config` must report `available: true, mode: test`. The site must display the test-mode warning before checkout. No actual gateway checkout was executed during this code change.

## Required sandbox acceptance cases

1. Correct monthly amount ₹499 and annual amount ₹4,999; server ignores client-provided amounts.
2. Pending/unapproved business cannot order; incorrect access code cannot retrieve private payment data.
3. Captured test payment is verified by server HMAC and gateway payment lookup, with exact order, amount, currency and merchant key.
4. An authorised but uncaptured payment remains pending.
5. Browser refresh/closed checkout can recover through Check payment status; never repay solely because confirmation timed out.
6. Duplicate signed webhooks do not extend the period twice. Confirm this against the actual database function, not just mocked SQL.
7. A processed refund deactivates the paid record; test payments never increase production dish allowance.
8. Reused gateway orders must match the configured amount and INR currency before returning checkout details.

## Go live

Live payments require a separate readiness decision after actual sandbox checkout, webhook delivery, database idempotency and refund tests, merchant account approval and the business's published commercial policies. This change does not enable live payments or initiate a refund. Paid plans are single-period purchases without automatic renewal.

References: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/ and https://razorpay.com/docs/webhooks/

## Read-only database prerequisite check

In the VS Code Terminal, from the SuggestDish project folder, run:

```sh
node scripts/check-payment-readiness.js
```

Use the intended database's `DATABASE_URL` from your private environment configuration. Never paste its value into chat or commit it. The checker uses a read-only transaction, reads schema metadata only, and does not apply migrations or touch business/payment records. Missing columns/functions are listed and exit status is nonzero. `schemaReady: true` confirms only the checked metadata: constraints, execution permissions, actual checkout, duplicate-event handling and refunds still need sandbox verification. A connection failure prints a generic message without connection credentials.
