# Alliance Home Services Backoffice

Modular field-service backoffice for Alliance Home Services.

## Architecture

Domain-sliced modular monolith:

```text
modules/
  customers/
  workOrders/
  billing/
  catalog/
```

Rules:

- routes: HTTP concerns only
- services: business logic/orchestration
- repositories: persistence/SQL only

## Current Domain Model

The model is customer-first and field-service oriented:

```text
customers
  -> customer_locations
      -> assets
          -> work_orders
              -> estimates
              -> invoices
```

Important tables:

- customers
- customer_contacts
- customer_locations
- customer_service_lines
- customer_notes
- customer_status_history
- service_lines
- property_types
- asset_types
- assets
- work_order_types
- work_orders
- work_order_assignments
- work_order_notes
- work_order_status_history
- catalog_items
- estimates
- estimate_line_items
- invoices
- invoice_line_items
- payments
- activity_events

## Local/EC2 commands

```bash
npm install
npm run db:reset
npm start
```

Deployment refresh:

```bash
git pull
npm install
npm run db:reset
pm2 restart gdor-backoffice --update-env
```

This zip intentionally excludes `.env` and `node_modules`.

## Public Lead Intake

Website form submissions should post to:

```text
POST /backoffice/api/public/leads
```

See `docs/public-lead-intake.md`.
