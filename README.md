# Alliance Home Services

Website and field-service backoffice for Alliance Home Services, covering:

- Alliance Garage Doors of Roswell
- Spring Water Pool Services

## Repository structure

```text
src/          Astro public website
public/       Public assets and browser-side form handling
backoffice/   Express/PostgreSQL field-service application
infra/        EC2, Nginx, PM2, and backup infrastructure
```

The public website includes dedicated service, specials, and confirmation pages for both service divisions. Shared interface elements, including the site header and mobile navigation, live under `src/components/`.

## Technology

### Public website

- Astro 5
- React islands
- Tailwind CSS 4
- Vercel preview integration

### Backoffice

- Node.js and Express
- PostgreSQL
- EJS views
- Jest integration tests
- PM2 process management

See [`backoffice/README.md`](backoffice/README.md) for the domain model and backoffice setup. Infrastructure and deployment details live in [`infra/README.md`](infra/README.md).

## Public website development

Node.js 22 is used by CI.

```bash
npm ci
npm run dev
```

Build the public site with:

```bash
npm run build
```

## Backoffice development

The backoffice has its own dependencies, environment configuration, database, and test workflow.

```bash
cd backoffice
npm ci
npm test
```

Do not run database reset, migration, restore, or deployment commands without first confirming the target environment. Never commit `.env` files, credentials, database dumps, or backups.

## Review and release workflow

- Develop changes on a feature branch.
- Open a pull request against the current integration branch.
- Use GitHub Actions and the Vercel Preview deployment to validate public-site changes.
- Require collaborator review before merging.
- Treat production promotion as a separate, explicit step after review and integration validation.
- Do not push directly to a production-tracking branch.

The public website and backoffice share this repository, so pull requests should identify which surface they change and preserve unrelated work.

## Additional documentation

- Public lead intake: [`backoffice/docs/public-lead-intake.md`](backoffice/docs/public-lead-intake.md)
- Backoffice testing: [`backoffice/docs/testing.md`](backoffice/docs/testing.md)
- Infrastructure: [`infra/README.md`](infra/README.md)
- Rebuild and restore: [`backoffice/docs/ops/rebuild-and-restore-runbook.md`](backoffice/docs/ops/rebuild-and-restore-runbook.md)
