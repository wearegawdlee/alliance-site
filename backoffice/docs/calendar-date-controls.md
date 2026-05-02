# Calendar/date controls

This build uses Flatpickr via CDN for date entry.

- `js-datetime-picker`: scheduled work fields, includes date and time. Format: `YYYY-MM-DD HH:mm`.
- `js-date-picker`: date-only fields such as recurring next-run date and tax-rate effective dates. Format: `YYYY-MM-DD`.

Scheduled Start remains date+time because technicians need a precise arrival/scheduled time. Recurring plan `next_run_date` remains date-only because it is a scheduling pointer, not a specific appointment timestamp.

Recurring create flow remains:
1. Create the first/original work order using `scheduled_start_at`.
2. If repeating, create a recurring plan linked to that first work order.
3. Advance the plan `next_run_date` to the next future occurrence so Generate Next does not duplicate the original work order.
