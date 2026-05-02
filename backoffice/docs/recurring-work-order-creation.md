# Recurring Work Order Creation UX

Recurring work remains modeled as:

```text
recurring_service_plans -> recurring_service_plan_runs -> work_orders
```

Work orders stay atomic occurrences. The customer detail Create Work Order form now includes a `Repeat this work` checkbox. When checked, the form creates a recurring service plan and immediately generates the first normal work order from that plan.

This keeps the data model clean while making the UI feel like a single work-order creation flow.

Behavior:

- unchecked: creates one normal open work order
- checked: creates a recurring service plan and then generates the first open work order
- generated work orders remain normal work orders
- subsequent recurring visits can still be generated from the Recurring Service screen
