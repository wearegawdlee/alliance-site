# Alliance Home Services — Project Handoff Context

## Project Overview

This project began as a simple lead tracking discussion ("maybe use a spreadsheet") and evolved into a deployed modular backoffice platform hosted on AWS, with a broader vision of becoming a field-service operating platform (potentially even productizable software in the spirit of ServiceTitan-like tools over time).

Current framing:

We are **not** building a garage door admin tool.

We are building a **modular field service operating system**, beginning with our own business as the proving ground.

---

# Current Stack

## Infrastructure

- AWS EC2 (Ubuntu 24.04)
- Nginx reverse proxy
- Node.js + Express
- Postgres
- PM2
- EJS views
- Astro public website

Routing:

```text
/             -> public marketing site
/backoffice   -> internal application
```

Unified single-stack AWS deployment was chosen intentionally over split hosting.

Reasons:
- one stack to own
- simpler routing
- easier internal/public form integration
- fewer auth/API boundary headaches
- long-term operational simplicity

---

# Major Milestones Completed

## v0.1 — Deployed Platform

Completed:

- EC2 provisioned
- Nginx configured
- Public Astro site serving from:

```text
/var/www/alliance-site
```

- Node backoffice proxied behind:

```text
/backoffice
```

- PM2 process management working
- Security groups configured
- Public site accessible via public IP
- Two AMI snapshots created:
  - base infrastructure
  - integrated platform state

---

## v0.2 — Domain Model Rebuild

Original lead-centric model was intentionally discarded.

Major decision:

Lead is NOT a first-class entity.

Customer is first-class.

Lead = lifecycle state.

Statuses:

- Prospect
- Qualified Lead
- Customer
- Inactive
- Lost

This was an intentional domain pivot.

---

## Current Domain Model

Core entities:

```text
customers
customer_contacts
customer_addresses
customer_service_lines
customer_notes

service_lines

work_orders

inventory_items

invoices
invoice_line_items
payments
```

Reference data:

```text
customer_statuses
work_order_statuses
invoice_statuses
payment_methods
lead_sources
```

Service lines currently seeded:

- Garage Doors
- Pools
- Motorized Screens

Important relationship:

```text
customers <-> service_lines
```

Many-to-many.

Deliberately designed for expansion.

---

# Modular Monolith Architecture (Settled Convention)

Important agreed structure:

```text
modules/
  customers/
    repository.js
    service.js
    routes.js

  workOrders/
  billing/
  catalog/
```

This is the architecture moving forward.

We explicitly rejected organizing by technical layers like:

```text
repositories/
routes/
services/
```

Reason:

Domain slices scale better.

Rules:

Routes:
- HTTP concerns only

Services:
- business logic/orchestration

Repositories:
- persistence/SQL only

Guiding principle:

```text
routes should not know SQL
repositories should not know HTTP
services should not know Express
```

Preserve this.

---

# Current Navigation

Current application navigation:

```text
Customers
Work Orders
Billing
Catalog
```

Customers slice implemented.

Other modules scaffolded.

Customer detail page working.

---

# Important Bug / Lesson

Major EJS bug discovered:

```text
include is not a function
```

Root cause:

Passing render local named:

```js
client
```

collided with EJS internal `client` option.

Resolution:
- renamed domain entity from Client to Customer
- regenerated app
- issue resolved

Important gotcha to remember.

---

# Bootstrapping / DevOps (Major Win)

Huge milestone:

Idempotent environment rebuild.

Single command:

```bash
npm run db:reset
```

Performs:
- drop schema
- recreate schema
- run migrations
- seed auth users
- seed domain data

Also:

```bash
npm run bootstrap
```

for fresh environment bring-up.

This removed manual DB teardown pain.

Very important foundation.

---

# Product Vision

This may evolve into more than internal software.

Potential product direction identified:

Field service platform including:

- CRM / customer lifecycle
- dispatch
- scheduling
- field invoicing
- inventory
- recurring maintenance workflows
- technician mobile workflow

Potential product opportunity recognized because we have:

Operator pain insight:
- Jay

Backoffice pain insight:
- Adriana

Engineering execution:
- us

This is strategic context.

---

# Design Principles To Preserve

Do not hardcode:

- brand names
- service lines
- workflows

Make these data/config driven.

Avoid building around garage doors specifically.

Build abstractions.

Important.

---

# Near-Term Roadmap

Priority order:

1. Customer create/edit flow
2. Work order creation tied to customer
3. Invoice generation from work orders
4. Inventory-backed invoice items
5. Replace session MemoryStore with connect-pg-simple
6. SSL via Certbot
7. Public lead intake endpoint
8. Scheduling/dispatch later

---

# Operational Commands

Logs:

```bash
pm2 logs gdor-backoffice
tail -f ~/.pm2/logs/gdor-backoffice-error.log
```

Restart:

```bash
pm2 restart gdor-backoffice --update-env
```

Bootstrap:

```bash
npm run db:reset
```

Deploy pattern:

```bash
git pull
npm install
npm run db:migrate
pm2 restart gdor-backoffice --update-env
```

---

# Current Version Markers

```text
v0.1 deployed AWS platform
v0.2 modular domain model
v0.3 repeatable bootstrap/devops
```

Current state:
approximately v0.3

---

# Mindset

We intentionally shifted from:

```text
small admin tool
```

to:

```text
modular field service operating platform
```

That framing should remain.

We are building substrate first.
Features second.

---

# Favorite accidental project motto

"From dev flops to DevOps."

Keep it.