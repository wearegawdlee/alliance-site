# Recurring Work Order Create Flow

This build keeps the recurring service plan data model intact while streamlining the user workflow.

## Model

- `recurring_service_plans` remain the recurring schedule/template.
- `work_orders` remain atomic job occurrences.
- `recurring_service_plan_runs` links each generated/initial occurrence to its plan.

## Customer create-work-order flow

On the customer detail page:

- Unchecked `Repeat this work` creates a normal one-time work order.
- Checked `Repeat this work` uses the work order's `Scheduled Start` as the first visit date.
- The first work order is created immediately as the original occurrence.
- A recurring service plan is created with `next_run_date` advanced to the next future occurrence.
- A `recurring_service_plan_runs` record links the plan to the original work order.

This avoids having two separate competing start-date fields in the UI.

## Date handling

Date helpers now accept either strings or `Date` objects from Postgres and normalize safely before adding days/months. This fixes the invalid date issue caused by appending `T00:00:00` to values that were already ISO timestamps.

## UI

Date fields use native HTML date/datetime controls. Recurring work requires the `Scheduled Start` field when the repeat checkbox is checked.
