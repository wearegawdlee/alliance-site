# Customer and Work Order Workflow

This version bridges the current manual field-service process without requiring a mobile app yet.

## Lifecycle

1. Website form creates a Customer in `Prospect` status.
2. Office user marks `Contact Made`, which moves the customer to `Qualified Lead` and records status history.
3. If the customer says “yes, please come out,” create a Work Order from the customer page. This promotes the customer to `Customer`.
4. Assign a technician on the work order. Assigned/scheduled jobs show in the work order queue.
5. Technician evaluates in the field. For now, the office records those findings as Work Order field notes.
6. When the customer agrees and work begins, mark the work order `In Progress`.
7. When work is completed, generate a draft invoice from the work order.
8. When payment is received, record payment in Billing. The invoice becomes Paid and the billing ticket is effectively closed.

## Important State Split

Customer state answers: what is this relationship?

Work order state answers: what is happening with this specific job?

So “customer agrees and work begins” is not a customer status. It is:

- customer: `Customer`
- work order: `In Progress`
