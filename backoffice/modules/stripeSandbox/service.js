const { getStripe, getPublicConfig } = require('../payments/stripeClient');

function isSandboxEnabled() {
  const explicit = String(process.env.STRIPE_SANDBOX_ENABLED || '').toLowerCase() === 'true';
  return explicit || process.env.NODE_ENV !== 'production';
}

function getStatus() {
  return {
    enabled: isSandboxEnabled(),
    stripe: getPublicConfig(),
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

function assertEnabled() {
  if (!isSandboxEnabled()) {
    throw new Error('Stripe sandbox is disabled. Set STRIPE_SANDBOX_ENABLED=true to enable it in this environment.');
  }
}

function toJson(value) {
  if (!value) return value;
  if (typeof value.toJSON === 'function') return value.toJSON();
  return value;
}

async function listCharges(limit = 3) {
  assertEnabled();
  const stripe = getStripe();
  return toJson(await stripe.charges.list({ limit: clampLimit(limit) }));
}

async function retrieveBalance() {
  assertEnabled();
  const stripe = getStripe();
  return toJson(await stripe.balance.retrieve());
}

async function listCustomers(limit = 5) {
  assertEnabled();
  const stripe = getStripe();
  return toJson(await stripe.customers.list({ limit: clampLimit(limit) }));
}

async function createCustomer({ name, email }) {
  assertEnabled();
  const stripe = getStripe();
  return toJson(await stripe.customers.create({
    name: name || 'Backoffice Sandbox Customer',
    email: email || undefined,
    metadata: {
      source: 'backoffice_stripe_sandbox',
      safe_to_delete: 'true',
    },
  }));
}

async function createPaymentIntent({ amount, currency, description }) {
  assertEnabled();
  const stripe = getStripe();
  const amountInCents = Math.round(Number(amount || 1) * 100);
  if (!Number.isFinite(amountInCents) || amountInCents < 50) {
    throw new Error('Amount must be at least $0.50.');
  }
  return toJson(await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: String(currency || 'usd').toLowerCase(),
    description: description || 'Backoffice sandbox PaymentIntent',
    automatic_payment_methods: { enabled: true },
    metadata: {
      source: 'backoffice_stripe_sandbox',
      safe_to_delete: 'true',
    },
  }));
}

async function retrievePaymentIntent(paymentIntentId) {
  assertEnabled();
  if (!paymentIntentId) throw new Error('Payment Intent ID is required.');
  const stripe = getStripe();
  return toJson(await stripe.paymentIntents.retrieve(paymentIntentId));
}

function clampLimit(limit) {
  const n = Number(limit || 3);
  if (!Number.isFinite(n)) return 3;
  return Math.max(1, Math.min(25, Math.floor(n)));
}

module.exports = {
  getStatus,
  isSandboxEnabled,
  listCharges,
  retrieveBalance,
  listCustomers,
  createCustomer,
  createPaymentIntent,
  retrievePaymentIntent,
};
