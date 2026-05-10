# Recurring Scheduling Automation

This build adds automated recurring work order generation without adding Redis or a separate queue service.

## Behavior

- The app starts a recurring scheduler when the web process starts.
- Default interval: every 60 minutes.
- Default lookahead: 14 days.
- Active recurring plans with `next_run_date` inside the lookahead window generate normal work orders automatically.
- Generation is idempotent via `recurring_service_plan_runs(recurring_service_plan_id, due_for)`.

## Due Date vs Scheduled Date

- `recurring_service_plans.next_run_date` is the contractual/service cadence date.
- `work_orders.scheduled_start_at` is the actual planned work date.
- If the due date falls on a weekend, blackout date, or over-capacity technician day, the system moves the scheduled date forward.
- The plan cadence advances from the due date, not the adjusted scheduled date, so service rhythm does not drift.

## Scheduling Controls

New admin pages:

- `/backoffice/scheduling/calendar`
- `/backoffice/scheduling/closures`
- `/backoffice/scheduling/capacity`

## Environment Variables

- `RECURRING_SCHEDULER_ENABLED=false` disables the automatic runner.
- `RECURRING_SCHEDULER_INTERVAL_MINUTES=60` controls scheduler frequency.
- `RECURRING_LOOKAHEAD_DAYS=14` controls how far ahead work orders are created.

## Manual Run

The calendar includes `Run Check Now` as an admin/debug action. It is not intended to be the normal workflow; automatic generation is the normal path.
