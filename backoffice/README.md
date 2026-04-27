# Alliance Back Office Demo

Drop this folder over `backoffice/` or copy files selectively.

## Run

```bash
npm install
cp .env.example .env
vi .env
npm run migrate:up
npm run seed:users
npm run seed:domain
npm start
```

Open `/backoffice`.

Seed login: `zundra@local.gdor` with `SEED_USER_PASSWORD`.
