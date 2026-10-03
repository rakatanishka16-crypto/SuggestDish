# Razorpay connection

The website integration is implemented, but no Razorpay account is connected until its API credentials are saved in Vercel. Never put key secrets in index.html, GitHub, or chat. Bank account details belong in Razorpay only. Razorpay settles captured payments to the linked settlement account according to the account's schedule and fees.

## Vercel

Open the project serving www.suggestdish.com (suggest-dish) → Settings → Environment Variables. Save these server-side values for Production:

| Variable | Value |
|---|---|
| RAZORPAY_KEY_ID | Your account's API Key ID |
| RAZORPAY_KEY_SECRET | Matching API Key Secret |
| RAZORPAY_WEBHOOK_SECRET | A strong private secret matching the webhook configuration |
| RAZORPAY_ENABLED | true |

Use Test Mode credentials for an end-to-end test first. Test payments are explicitly labelled and do not enable live benefits. After testing, replace the Key ID and Key Secret with Live Mode credentials from the activated account, configure the live webhook, and redeploy. Set RAZORPAY_ENABLED=false to pause new checkout.

## Razorpay dashboard (complete these steps yourself)

Account & Settings → API Keys: select Test Mode or Live Mode as appropriate and use the matching API keys. Keep the Key Secret private; paste it directly into Vercel's environment settings.

Account & Settings → Webhooks: configure this HTTPS URL:

https://www.suggestdish.com/api/razorpay-webhook

Use the same private webhook secret as RAZORPAY_WEBHOOK_SECRET. Subscribe to payment.captured, order.paid, and refund.processed. Configure automatic payment capture; authorised but uncaptured payments do not activate a plan. Confirm the settlement bank account and account activation in Razorpay. Do not send a bank account number to SuggestDish.

Redeploy from Vercel → Deployments → latest production deployment → Redeploy after changing environment variables. Changing settings alone does not update an existing deployment.

## Checkout and review

Submit the business listing first and save its reference and private access code. The code is issued once and stored only as a SHA256 hash in Neon. The website keeps it in sessionStorage for the current browser session; owners must save it privately for later use.

A reviewer approves the business with the existing review process. Owners then open /#business-checkout and use their reference and access code to purchase the monthly or annual plan. Payments never approve an unverified business. There are no recurring mandates or automatic renewals.

Monthly: INR 49,900 paise (₹499), capacity 3 dishes, one calendar month.
Annual: INR 499,900 paise (₹4,999), capacity 2 dishes, one calendar year.

Additional dishes still require source/menu review before being added. This integration records paid capacity; it does not invent extra dishes from the signature dish submission. Curated source menus imported earlier are not owner-submitted paid listings and are unchanged.

New checkout is blocked while the same restaurant has an active paid plan. A pending order is reused for the same plan. If an owner needs to change a pending order's plan, handle it through review rather than accepting overlapping payments. A creating reservation times out after 30 minutes; an unpaid gateway order remains reusable.

Razorpay order amounts are fixed by the server. Browser responses require HMAC verification against the stored order ID; the server fetches the gateway payment and checks order, amount, currency, merchant key and captured state before recording payment. Signed webhooks and status reconciliation recover interrupted browser confirmations. Duplicate confirmation does not extend the plan. Refund notifications revoke the corresponding paid record, including partial refunds.

Review records in public."BusinessPlanPayment". Test records use rzp_test_ keys and must never count toward live capacity. Live capacity is 3 or 2 only when a matching captured live payment has endsAt in the future; otherwise default to the free allowance of 1 dish. No public endpoint lists contact details or payment history without the private access code.

## Existing owners without an access code

After independently verifying the owner through the business's official contact, a trusted reviewer may issue a fresh random 32-byte hex code, store only its SHA256 hash in BusinessSubmission.checkoutTokenHash, and give the code privately to the owner. Do not expose codes in public URLs, comments or logs. This invalidates any previous access code for that submission.

## Verification completed

Automated tests cover server pricing, ownership access, pending approval, invalid signatures, captured/authorised states, refund revocation, webhook signatures, disabled configuration and previous listing/location flows. Live Razorpay checkout and settlement remain untested until the account credentials are configured. No real payment is made by this setup.
