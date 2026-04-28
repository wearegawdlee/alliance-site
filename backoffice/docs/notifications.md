# Notifications

The backoffice now has a lightweight notification layer. It is intentionally simple: business workflows save data first, then notification delivery is attempted asynchronously so a failed email/webhook does not break lead intake or office workflows.

## Events currently wired

- `website_lead.received` when the public website form creates a new prospect
- `work_order.assigned` when a work order is assigned through the work order edit form
- `invoice.generated` when a draft invoice is generated from a work order
- `payment.recorded` when payment is recorded from Billing

## Email configuration

Add these values to `.env` on EC2:

```bash
NOTIFICATIONS_ENABLED=true
APP_BASE_URL=https://agdofroswell.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false

SMTP_USER=admin@agdofroswell.com
SMTP_PASS=xxxxxxxxxxxxxxxx

SMTP_FROM="Alliance Backoffice <admin@agdofroswell.com>"

NOTIFY_LEADS_EMAIL=leads@agdofroswell.com
```

For Google Workspace/Gmail, use an app password or SMTP-compatible credential for the sending account.

## Webhook configuration, optional

If you want to notify a webhook instead of, or in addition to, email:

```bash
NOTIFICATION_WEBHOOK_URL=https://example.com/webhook
```

The payload is JSON:

```json
{
  "subject": "New website lead: Jane Customer",
  "text": "...",
  "eventType": "website_lead.received",
  "url": "https://your-domain.com/backoffice/customers/123",
  "metadata": {}
}
```

## Test command

After setting `.env`:

```bash
npm run notify:test
```

Then restart PM2 after changing environment values:

```bash
pm2 restart gdor-backoffice --update-env
```

## Failure behavior

Notification delivery errors are logged, but they do not stop lead intake, work order updates, invoice generation, or payment recording.
