# Idempotency / Double-Submit Hardening

This patch focuses on the places where accidental double-clicks, retries, redirects, or Stripe webhook replays could create duplicate operational records.

## Added

- Global submit-button disabling for non-GET forms.
- Stripe Checkout Session creation now uses idempotency keys for invoice card checkout.
- Stripe off-session autopay PaymentIntent creation now uses idempotency keys.
- Payment attempt creation is DB-backed and retry-safe.
- Payment reconciliation continues to be safe if Stripe redirect and webhook both arrive.
- Work-order invoice sync now uses a transaction advisory lock per work order.
- Invoice submission is idempotent:
  - first submit sends the invoice
  - repeated submit does not send a duplicate email
  - explicit reminder/resend still sends
- Batch invoice submit skips invoices already submitted instead of sending duplicate emails.

## New Migration

`1745820000000_idempotency-hardening.js`

Adds defensive indexes:

- one payment attempt per Stripe Checkout Session
- one payment attempt per Stripe PaymentIntent
- one Stripe-backed payment per Stripe reference number
- lookup index for invoice attempt/status checks

## Operator Behavior

When a form is submitted, the clicked button changes to a loading label and disables immediately. This prevents most accidental double-submits before the server is reached.

The server/database protections are still the true source of safety.
