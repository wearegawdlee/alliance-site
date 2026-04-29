# Simplified workflow state machines

This build separates lead conversion, work execution, and billing.

## Customer

Website intake and manual entry create a Prospect. Contact made is an event, not a state change.

- Prospect
- Customer
- Lost / Inactive

Creating a work order converts the customer from Prospect to Customer.

## Work order

Work order states are intentionally minimal:

- Open
- Completed
- Cancelled

Scheduling, rescheduling, assignment, and itemization are mutable work order data, not states.

Completion synchronizes the one invoice for the work order. If there are no line items, no invoice is generated.

A paid invoice locks both the invoice and associated work order.

## Invoice

- Created
- Submitted
- Paid

Submit may be repeated and can be used as a reminder. Payment is only allowed after submit. Recording payment sends a receipt notification when the customer has an email address.

## Invariants

- One work order has at most one invoice.
- One invoice belongs to one work order.
- Cancelled work orders are final.
- Paid invoices are immutable.
