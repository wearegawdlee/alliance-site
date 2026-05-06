# Stripe Sandbox

The backoffice includes an admin-only Stripe Sandbox page at:

```text
/backoffice/admin/stripe-sandbox
```

Use this page to learn Stripe API behavior without wiring every call into production business workflows first.

## Access

The route is protected by normal backoffice login and requires the `admin` role.

In non-production environments it is enabled by default. In production-like environments, it is disabled unless this environment variable is set:

```text
STRIPE_SANDBOX_ENABLED=true
```

## Required Stripe configuration

```text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

The sandbox calls Stripe from the Express server only. The browser never receives the secret key.

## Current sandbox actions

- Retrieve Stripe balance
- List charges
- List customers
- Create a test customer
- Create a test PaymentIntent
- Retrieve a PaymentIntent by ID

Objects created by the sandbox include metadata:

```json
{
  "source": "backoffice_stripe_sandbox",
  "safe_to_delete": "true"
}
```

## Safety notes

Use Stripe test mode keys for this page. Do not use live customer payment details here.
