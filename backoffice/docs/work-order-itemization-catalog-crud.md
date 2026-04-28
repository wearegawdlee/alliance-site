# Work Order Itemization + Catalog CRUD

This update makes work orders closer to an operational job folder.

## Work orders

Added:

- Search/filter on `/backoffice/work-orders`
- Filters by status, service line, and assigned technician/unassigned
- Work order detail shows inspection/itemized charges
- Itemized charges are captured after inspection and before invoice generation
- Pricing is no longer required during the initial work-order creation/intake step

## Work order line items

New table:

```text
work_order_line_items
```

Purpose:

```text
Jay evaluates work -> Adriana records parts/labor/services -> draft invoice copies these rows
```

This bridges the current manual process while leaving room for a later mobile technician app.

## Catalog

Catalog now has CRUD:

- Create item
- Edit item
- Delete item
- Archive instead of delete when referenced by work orders, estimates, or invoices
- Search/filter catalog items

Catalog item types currently supported:

```text
service
labor
part
material
fee
```
