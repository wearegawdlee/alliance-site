# Leads as Customer Requests — v1.0 Freeze Change

## Model change

Customers are now the durable identity/account record. Leads are first-class service requests attached to a customer.

Old mental model:

```text
lead/prospect -> customer
```

New mental model:

```text
customer -> many leads/requests
```

## Intake behavior

Website intake now:

1. Normalizes incoming email, phone, and street address.
2. Finds an existing customer by:
   - exact email match, or
   - exact normalized phone match, or
   - exact normalized street-address match.
3. Creates a customer only when no match exists.
4. Always creates a new `leads` row attached to the customer.
5. Adds lead/customer notes and activity events.

## Prospects queue

The Prospects page is now a lead queue, not a customer-status queue.

It shows active leads with:

- requested service type
- submitted contact info
- customer link
- owner/claim status
- contacted state
- latest lead note

Marking contacted updates the lead and writes notes to both the lead and customer timeline.

## Work order conversion

Creating a work order from the customer workflow:

- still moves a prospect customer to customer status
- closes matching open leads for that customer/service line
- records activity on the closed lead

## Why this matters

A repeat customer can submit multiple service requests without creating duplicate customer records. This supports real customer history while keeping the operational lead queue clean.
