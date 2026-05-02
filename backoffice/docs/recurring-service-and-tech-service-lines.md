# Recurring Service + Technician Service Lines

## Recurring service model

Recurring work is modeled as a plan that generates normal atomic work orders.

```text
recurring_service_plans -> recurring_service_plan_runs -> work_orders
```

This keeps the existing work order flow intact:

```text
Open -> Completed | Cancelled
```

A recurring plan can be generated manually from the plan detail page. Auto-generation can be added later as a scheduled task once the team trusts the model.

## Technician service lines

Technician access now has two layers:

- role: what kind of app/access the user gets
- service line assignment: what work/catalog service area the tech sees

Service-specific technician roles:

```text
garage_technician
pool_technician
screen_technician
```

The generic `technician` role still acts as an umbrella role for route guards.
