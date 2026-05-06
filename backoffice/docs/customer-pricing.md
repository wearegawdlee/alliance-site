# Customer Pricing Overrides

Some services, especially recurring pool maintenance, have customer-specific agreed pricing that should not be represented as duplicated catalog items.

Model:

```text
catalog_items = clean service catalog / baseline price
customer_pricing = customer-specific override per catalog item
work_order_line_items = snapshot of the selected price at time of work
invoice_line_items = snapshot copied from completed work order
```

When adding a catalog item to a work order, the system checks for an active customer-specific price for that customer and catalog item. If one exists, that price is used by default. Otherwise the catalog item price is used.

Existing customers can be backfilled with fixed overrides. New customer pricing can later be derived from formulas, but invoices and work orders should always snapshot the price used historically.
