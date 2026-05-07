# Themed customer invoices

Customer-facing invoice pages now choose a presentation based on the invoice work order service line.

## Pools

Invoices tied to the `pools` service line use a clean printable pool-service layout inspired by the current Spring Water Pool Services invoice format. This is intentionally temporary until the pool business is rebranded.

## Garage Doors

Invoices tied to the `garage_doors` service line use the Alliance Garage Doors of Roswell visual language: dark navy header, green accent, trust-forward service presentation, and card-based totals.

## Source of truth

Only the presentation changes. Payment behavior still uses the existing invoice, payment, Stripe checkout, and webhook reconciliation flow.

## Print behavior

The payment action panel is hidden when printing so the customer can print or save a clean invoice copy.
