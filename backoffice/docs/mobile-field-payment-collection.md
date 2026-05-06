# Mobile Field Payment Collection

## Purpose

Technicians can collect card payments from the mobile work order view while they are still on site.

This covers the real-world flow:

1. Technician opens assigned work order on phone.
2. Technician adds billable service items.
3. Customer wants to pay immediately.
4. Technician taps **Collect Card Payment Now**.
5. Stripe Checkout opens.
6. Stripe webhook updates the invoice/payment state.

## Routes

Authenticated technician routes:

- `POST /backoffice/tech/work-orders/:id/collect-payment`
- `POST /backoffice/tech/work-orders/:id/customer-payment-page`

The first route sends the user directly into Stripe Checkout.

The second route prepares the invoice and opens the public customer payment page at `/pay/i/:token`.

## Invoice Behavior

Payment collection is not coupled to work order completion.

If the work order has billable line items but no invoice yet, the mobile payment flow prepares/syncs the invoice from the current line items before starting payment.

This allows:

- payment before formal completion
- payment during completion
- payment after completion

Paid invoices still lock the work order.

## Payment Rules

- Field collection is card-only.
- ACH remains available for recurring/autopay setup through the customer payment portal.
- The app never handles raw card data.
- Stripe Checkout collects card details.
- Stripe webhook remains the source of truth for marking payments as succeeded.

## Technician UI

The mobile work order page now includes a **Collect Payment** card with:

- invoice status when an invoice exists
- amount based on current work order line items
- **Collect Card Payment Now** button
- **Open Customer Pay Page** button
- copyable public payment link when an invoice already exists

## Important Guardrails

- No line items means no payment collection.
- Paid invoices cannot be regenerated.
- The payment amount comes from the server-side invoice, never from the client.
- Returning from Stripe does not mark the invoice paid; only the webhook does.
