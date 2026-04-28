# Customer CRUD + Search/Filter

Adds live-ops customer management behavior:

- Customer create remains at `/backoffice/customers/new`
- Customer edit remains at `/backoffice/customers/:id/edit`
- Customer delete is available from the customer detail page only when the record has no work orders, estimates, or invoices
- Customer list supports filters by:
  - free text search: name, company, contact, phone, email, address, city
  - customer status
  - service line
  - assigned owner
  - lead source

Deletion is intentionally guarded. If operational history exists, preserve the record and use lifecycle status such as Lost or Inactive instead.
