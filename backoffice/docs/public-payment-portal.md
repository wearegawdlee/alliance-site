# Public Payment Portal

## Purpose

The public payment portal lets customers pay without logging into the backoffice.

Customer-facing flow:

1. Customer receives invoice email with a secure payment link.
2. Customer opens `/pay/i/:token`.
3. Customer reviews invoice amount and line items.
4. Customer pays one-time invoices by card through Stripe Checkout.
5. Stripe webhook records payment and marks the invoice paid.
6. Customer receives a receipt email.

Fallback flow:

1. Customer goes to `/pay`.
2. Customer enters invoice number plus email, phone, or ZIP code.
3. System redirects to the secure invoice payment page.

## Routes

- `GET /pay` — public lookup form.
- `POST /pay/lookup` — invoice lookup by invoice number and identity check.
- `GET /pay/i/:token` — customer-safe invoice detail/payment page.
- `POST /pay/i/:token/card-checkout` — creates Stripe Checkout session for card payment.
- `GET /pay/autopay/:token` — public autopay setup page.
- `POST /pay/autopay/:token/setup/card` — hosted card setup.
- `POST /pay/autopay/:token/setup/ach` — hosted ACH setup.
- `POST /pay/autopay/:token/settings` — enable/disable autopay using saved payment method.
- `GET /pay/success` — customer return page after Stripe checkout.

## Security Model

- Customer never sees `/backoffice`.
- Customer never enters card or bank details into our app.
- Stripe Checkout/Setup owns payment capture.
- Public access is via random invoice token stored on `invoices.public_payment_token`.
- Manual lookup requires invoice number plus one identity factor: primary email, primary phone, or service ZIP.
- Payment amount is always read from the database, never from the browser.
- Webhook is the source of truth for successful payment.

## Payment Type Rules

- One-time/non-recurring invoice payments: card only.
- Recurring autopay setup: card or ACH.
- ACH may remain `payment_pending` until Stripe confirms success/failure.

## Environment

Required for live Stripe processing:

```env
STRIPE_SECRET_KEY=sk_live_or_test...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_PUBLIC_URL=https://alliancehomeservices.com
PUBLIC_SITE_URL=https://alliancehomeservices.com
```

`PUBLIC_SITE_URL` is optional if it is the same as `APP_PUBLIC_URL`.

## Nginx Note

The public site and backoffice can still live behind the same domain. Route `/pay` to this Node app the same way `/backoffice` is routed.

Example intent:

```nginx
location /backoffice { proxy_pass http://127.0.0.1:3001; }
location /pay { proxy_pass http://127.0.0.1:3001; }
```

Keep `/api/public` routed to the Node app if the static site posts leads there.

## Invoice Balance Guardrail

Customer-facing payment pages do not treat `balance_due = 0` as paid unless the invoice status is actually `paid`.

The payable amount is calculated as:

```text
max(stored balance_due, total_amount - deposit_amount) - payments recorded
```

This prevents a draft/created invoice with stale `balance_due = 0` from incorrectly displaying as paid. Customers may pay a created invoice before the work order is completed if they have the secure payment link.

## Streamlined invoice lookup

The public `/pay` flow no longer requires an invoice number. Customers enter the email address or phone number on file and the system returns a short-lived results page containing only unpaid invoices.

Invoice number is now an optional shortcut:

- email/phone only -> unpaid invoice list
- invoice number + email/phone -> direct invoice page when matched
- invoice number mismatch -> fallback to unpaid invoice list for that email/phone

The results URL uses a temporary lookup token instead of exposing the customer email or phone number in the URL. Lookup tokens expire after 15 minutes.

Only unpaid invoices with a computed amount due are shown. The amount due is calculated from invoice totals and recorded payments so stale `balance_due` values do not hide payable invoices.
