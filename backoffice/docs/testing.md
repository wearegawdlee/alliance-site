# Integration test harness

This project now has a small integration test suite around the core business rules that are most likely to break during feature work.

## Setup

Create a disposable Postgres database for tests. Do not point tests at production or your main dev database.

Example:

```bash
createdb agd_backoffice_test
cp .env.test.example .env.test
```

Edit `.env.test`:

```env
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/agd_backoffice_test
NOTIFICATIONS_ENABLED=false
BASE_PATH=/backoffice
```

The reset script refuses to run against a database URL that does not look like a test database unless you intentionally set:

```env
ALLOW_NON_TEST_DATABASE=true
```

## Commands

```bash
npm install
npm test
```

`npm test` runs Jest. The Jest global setup runs `scripts/reset-test-db.js`, which drops/recreates the public schema, runs migrations, and seeds users/domain/tax rates.

You can also reset manually:

```bash
npm run test:reset
```

Or run reset + tests explicitly:

```bash
npm run test:integration
```

## Current coverage

The initial suite covers:

- Website intake creates a Prospect and no work order.
- Creating a work order converts Prospect → Customer.
- Work order creation does not require a schedule.
- Completing a work order without line items creates no invoice.
- Completing a work order with line items creates exactly one invoice.
- Completing again regenerates the same invoice rather than making a duplicate.
- Tax, percent discount, and deposit are calculated into invoice totals.
- Submitted invoice can be paid.
- Paid invoice locks the associated work order.
- Cancelled work order cannot be completed afterward.

These are intentionally integration tests rather than mocked unit tests because the important failures here usually happen across route/service/repository/database boundaries.
