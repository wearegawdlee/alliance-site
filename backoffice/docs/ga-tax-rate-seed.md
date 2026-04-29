# Georgia Tax Rate Seed

Adds `npm run db:seed:tax-rates`, which seeds Georgia sales/use tax jurisdiction rates from the Georgia Sales and Use Tax Rate Chart effective April 1, 2026.

Rates are stored as decimals:

- 6% = `0.06000`
- 7.75% = `0.07750`
- 8.9% = `0.08900`

Run manually:

```bash
npm run db:seed:tax-rates
```

`npm run db:reset` now includes this task after domain seeding.

Special city/jurisdiction rows are represented as county + city rows, with county-level rows retained as fallbacks.
