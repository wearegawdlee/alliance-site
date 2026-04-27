# gdor_backoffice

Starter Node.js back-office app for lead tracking. The repo root is intentionally named `gdor_backoffice` so it can grow into a broader internal ops system later without forcing a rename.

## Stack
- Node.js
- Express
- EJS
- express-session
- bcryptjs
- dotenv
- JSON file persistence for the starter version

This version uses a local JSON store so you can move fast while we finish the auth and deployment layers before swapping storage to Postgres.

## Features in this version
- Base-path aware routing via `BASE_PATH`
- Login page at `/backoffice/login`
- Session-based auth for protected back-office routes
- Lead list with filters
- Create lead
- Edit lead
- Lead detail view
- Quick status updates
- Notes timeline
- Seeded internal users for team assignment
- File-based persistence in `data/store.json`

## Seeded local users
- `jay@local.gdor`
- `zundra@local.gdor`
- `adriana@local.gdor`
- `denise@local.gdor`
- `deji@local.gdor`

Default password for all seeded users:

```text
ChangeMe123!
```

You can override the seeded password with `SEED_USER_PASSWORD` before first run.

## Getting started

Create a `.env` file from `.env.example`, then run:

```bash
npm install
npm run seed
npm start
```

Open:

```text
http://localhost:3000/backoffice
```

You should be redirected to:

```text
http://localhost:3000/backoffice/login
```

## Configuration

`.env.example`:

```env
PORT=3000
BASE_PATH=/backoffice
SESSION_SECRET=replace-me-in-production
SEED_USER_PASSWORD=ChangeMe123!
```

## Notes
- This auth layer is intentionally simple: server-rendered login + session cookie.
- It is suitable for an internal/family back-office MVP.
- Postgres replaces the JSON store in the next step.

## Suggested next extensions
- Postgres-backed normalized schema
- Jobs table separate from leads
- Review request tracking
- Payment tracking
- Website form POST integration from Astro site
- SMS/email notifications
- Calendar scheduling
