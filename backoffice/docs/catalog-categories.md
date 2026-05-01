# Catalog Categories

Catalog categories group billable catalog items underneath a service line so office users and future technician/mobile views do not search one large item list.

Model:

```text
service_lines
  -> catalog_categories
      -> catalog_items
```

Rules:

- Categories belong to one service line.
- Catalog items may belong to one category.
- Uncategorized catalog items are still supported for backward compatibility.
- Work order item pickers show active items for the work order service line.
- Items under inactive categories are hidden from work order pickers.
- Inactive items are hidden from work order pickers.

Seeded category examples include Garage Door Springs, Openers, Service Calls, Labor, Parts / Misc, and similar Pool / Motorized Screen categories.
