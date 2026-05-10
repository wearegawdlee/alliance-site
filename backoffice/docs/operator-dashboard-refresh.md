# Operator Dashboard Refresh

This update turns the dashboard from a raw object list into an operator command center.

## What changed

- Added a large command-center header with quick links.
- Reworked KPI cards for today's work, unassigned jobs, unpaid invoices, new leads, and monthly revenue.
- Added operational charts:
  - 7-day scheduled workload
  - 30-day revenue trend
  - invoice status breakdown
  - 14-day lead intake trend
- Added a money snapshot for outstanding AR, overdue AR, collected payments, and failed payments.
- Replaced long unbounded lists with capped action queues and links to the full pages.
- Kept dashboard purpose focused on exceptions and things needing attention.

## Dashboard philosophy

The dashboard should not show every record in the system. It should answer:

- What needs attention?
- What is scheduled today?
- Are we overloaded soon?
- Are invoices getting paid?
- Are new leads coming in?

Full lists remain on their dedicated pages: Work Orders, Billing, Prospects, Customers, and Scheduling.
