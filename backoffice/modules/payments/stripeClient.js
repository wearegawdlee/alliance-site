let Stripe = null;
try { Stripe = require('stripe'); } catch (_) { Stripe = null; }

function isConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && Stripe);
}

function getStripe() {
  if (!Stripe) throw new Error('Stripe package is not installed. Run npm install after pulling this update.');
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return Stripe(process.env.STRIPE_SECRET_KEY);
}

function getPublicConfig() {
  return {
    configured: isConfigured(),
    publishableKeyConfigured: Boolean(process.env.STRIPE_PUBLISHABLE_KEY),
    webhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  };
}

module.exports = { getStripe, isConfigured, getPublicConfig };
