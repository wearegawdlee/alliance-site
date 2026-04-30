# Roles, User Management, and Technician Dashboard

Adds role-based access control and user management.

## Roles

Seeded roles:

- `admin`: full system access, including user management
- `finance`: dashboard, customers, work orders, billing, catalog, tax rates
- `technician`: technician dashboard, assigned work orders, self account management

Positions remain human/business titles such as Owner, Admin, Technician, Office Manager, or Bookkeeper. Roles control access.

## New Routes

- `/backoffice/users` admin-only user management
- `/backoffice/tech/dashboard` technician work queue
- `/backoffice/account` self account management

## Behavior

- Technician-only users are redirected to the technician dashboard after login.
- Technician-only users see a trimmed navigation.
- Technician-only users only see work orders assigned to them.
- Server-side route guards protect access; navigation hiding is not the security boundary.
