# Dashboard + Work Order Flow

The backoffice now opens to `/backoffice/dashboard` instead of the customer list.

Operational model:

1. Website lead creates a Prospect customer.
2. Contact is made and the customer can be qualified.
3. Work order is created from the customer record.
4. Work order becomes the operational headliner.
5. Dashboard highlights:
   - new website leads
   - uncontacted prospects
   - unassigned work orders
   - jobs scheduled today
   - upcoming jobs
   - unpaid invoices
   - recent activity events

Work order statuses:

- Requested
- Contacted
- Scheduled
- Assigned
- In Evaluation
- Estimate Pending
- Approved
- In Progress
- Completed
- Invoiced
- Closed
- Cancelled

Payment recording now closes the linked work order when the invoice is fully paid.
