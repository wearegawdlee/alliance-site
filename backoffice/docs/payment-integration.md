# Payment Integration

## Boundary

The backoffice owns customers, work orders, invoices, recurring plans, payment attempts, and payment status. Stripe owns sensitive card/bank details, mandates, bank verification, and payment collection.

Do not store card numbers, bank account numbers, routing numbers, CVVs, or raw payment credentials in Postgres.

## Supported Workflows

### One-time / non-recurring services

- Invoice must be submitted before online payment.
- One-time online payment is card-only.
- Staff opens an invoice and uses **Send / Open Card Checkout**.
- Stripe Checkout collects the card payment.
- Stripe webhooks mark the payment attempt succeeded/failed and record the payment against the invoice.

### Recurring services

- Customer may save a card or ACH bank account from the Payment Settings page.
- Saved payment methods are collected through Stripe hosted setup mode.
- Staff can enable autopay and choose a default method.
- Autopay can charge card or ACH.
- ACH payments may remain processing before settlement/failure.

## Routes

- `GET /backoffice/payments/customers/:customerId`
- `POST /backoffice/payments/customers/:customerId/setup/card`
- `POST /backoffice/payments/customers/:customerId/setup/ach`
- `POST /backoffice/payments/customers/:customerId/autopay`
- `POST /backoffice/payments/invoices/:invoiceId/card-checkout`
- `POST /backoffice/payments/invoices/:invoiceId/autopay-charge`
- `POST /backoffice/payments/webhook`

## Environment

```env
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
APP_PUBLIC_URL=https://your-domain.com
```

`APP_PUBLIC_URL` should be the public origin only. The app appends `/backoffice/...` paths itself.

## Data Model

- `payment_providers`
- `customer_payment_profiles`
- `customer_payment_methods`
- `customer_autopay_settings`
- `payment_attempts`
- `payment_events`

Existing `payments` remains the accounting record of money received. Online attempts only become real payments after Stripe confirms success.

## Invoice State Notes

Existing invoice states remain valid:

- `created`
- `submitted`
- `paid`
- `void`

New online payment states:

- `payment_pending`
- `payment_failed`

A payment attempt may be `checkout_created`, `processing`, `succeeded`, or `failed`.
