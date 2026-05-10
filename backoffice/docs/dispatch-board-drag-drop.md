# Dispatch Board Drag-and-Drop

Adds a weekly dispatch board at `/backoffice/scheduling/dispatch`.

## What it does

- Shows scheduled work orders by day and technician.
- Includes an Unassigned column.
- Supports drag-and-drop movement between days and technicians.
- Updates `work_orders.scheduled_start_at` and the technician assignment through a JSON endpoint.
- Preserves the existing time-of-day when moving a work order to another date.
- Shows per-cell job counts and capacity badges when configured.
- Flags over-capacity cells visually.
- Blocks dispatch-board rescheduling for paid and cancelled work orders.

## Endpoint

```text
PATCH /backoffice/scheduling/work-orders/:id/schedule
```

Body:

```json
{
  "scheduled_date": "2026-05-11",
  "assigned_user_id": "3"
}
```

Use an empty `assigned_user_id` to move a work order to Unassigned.

## Notes

This is intentionally a lightweight dispatch board, not a full route optimizer. The human dispatcher remains in control, while the system makes schedule and assignment changes quick and visible.
