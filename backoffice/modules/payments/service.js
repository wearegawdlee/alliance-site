const repo = require('./repository');
const { getStripe, getPublicConfig } = require('./stripeClient');
const billingRepo = require('../billing/repository');
const notifications = require('../notifications/service');
const { amountDue } = require('./amounts');

function configuredBaseUrl(req) {
  return (process.env.APP_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

function appUrl(req, target) {
  return `${configuredBaseUrl(req)}${req.app.locals.routePath(target)}`;
}

function publicUrl(req, target) {
  const base = (process.env.PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  return `${base}${target.startsWith('/') ? target : `/${target}`}`;
}

function checkoutUrl(req, target) {
  if (String(target || '').startsWith('/pay')) return publicUrl(req, target);
  return appUrl(req, target);
}

function describeStripePaymentMethod(pm) {
  if (pm.type === 'us_bank_account') {
    return { payment_type: 'ach', bank_name: pm.us_bank_account?.bank_name || null, last4: pm.us_bank_account?.last4 || null };
  }
  return { payment_type: 'card', brand: pm.card?.brand || null, last4: pm.card?.last4 || null, expiration_month: pm.card?.exp_month || null, expiration_year: pm.card?.exp_year || null };
}

async function getCustomerPaymentOverview(customerId) {
  const overview = await repo.getCustomerPaymentOverview(customerId);
  if (!overview) return null;
  overview.stripe = getPublicConfig();
  return overview;
}

async function ensureStripeCustomer(customerId) {
  const existing = await repo.getCustomerProfile(customerId);
  if (existing) return existing.provider_customer_id;
  const overview = await repo.getCustomerPaymentOverview(customerId);
  if (!overview) throw new Error('Customer not found.');
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: overview.customer.display_name,
    email: overview.customer.customer_email || undefined,
    metadata: { internal_customer_id: String(customerId) }
  });
  await repo.upsertCustomerProfile(customerId, customer.id);
  return customer.id;
}

async function createSetupCheckoutSession(req, customerId, paymentType, options = {}) {
  if (!['card','ach'].includes(paymentType)) throw new Error('Unsupported payment type.');
  const stripe = getStripe();
  const providerCustomerId = await ensureStripeCustomer(customerId);
  const methods = paymentType === 'ach' ? ['us_bank_account'] : ['card'];
  const session = await stripe.checkout.sessions.create({
    mode: 'setup',
    customer: providerCustomerId,
    payment_method_types: methods,
    success_url: checkoutUrl(req, options.successPath || `/payments/customers/${customerId}?setup=success`),
    cancel_url: checkoutUrl(req, options.cancelPath || `/payments/customers/${customerId}?setup=cancelled`),
    metadata: { internal_customer_id: String(customerId), setup_payment_type: paymentType, ...(options.metadata || {}) }
  });
  return session.url;
}

async function createInvoiceCardCheckoutSession(req, invoiceId, options = {}) {
  const invoice = await repo.getInvoiceForOnlinePayment(invoiceId);
  if (!invoice) throw new Error('Invoice not found.');
  if (!['created','submitted','payment_failed'].includes(invoice.status_code)) throw new Error('Only created, submitted, or failed invoices can be paid online.');
  const paid = await repo.getInvoicePaidAmount(invoice.id);
  const amount = amountDue(invoice, paid);
  if (!amount || amount <= 0) throw new Error('Invoice has no balance due.');
  const stripe = getStripe();
  const providerCustomerId = await ensureStripeCustomer(invoice.customer_id);
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: providerCustomerId,
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', product_data: { name: invoice.invoice_number || `Invoice #${invoice.id}` }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
    success_url: checkoutUrl(req, options.successPath || `/billing/invoices/${invoice.id}?payment=success`),
    cancel_url: checkoutUrl(req, options.cancelPath || `/billing/invoices/${invoice.id}?payment=cancelled`),
    payment_intent_data: { metadata: { internal_invoice_id: String(invoice.id), internal_customer_id: String(invoice.customer_id), payment_type: 'card', ...(options.metadata || {}) } },
    metadata: { internal_invoice_id: String(invoice.id), internal_customer_id: String(invoice.customer_id), payment_type: 'card', ...(options.metadata || {}) }
  });
  await repo.createPaymentAttempt({ invoice_id: invoice.id, customer_id: invoice.customer_id, payment_type: 'card', status: 'checkout_created', amount, provider_checkout_session_id: session.id, metadata: { online: true, ...(options.metadata || {}) } });
  return session.url;
}

async function setDefaultPaymentMethod(customerId, methodId) { return repo.setDefaultPaymentMethod(customerId, methodId); }
async function deactivatePaymentMethod(customerId, methodId) { return repo.deactivatePaymentMethod(customerId, methodId); }
async function updateAutopay(customerId, data) { return repo.updateAutopay(customerId, data); }

async function chargeInvoiceWithSavedMethod(invoiceId) {
  const overviewInvoice = await repo.getInvoiceForOnlinePayment(invoiceId);
  if (!overviewInvoice) throw new Error('Invoice not found.');
  const overview = await repo.getCustomerPaymentOverview(overviewInvoice.customer_id);
  if (!overview?.autopay?.is_enabled || !overview.autopay.payment_method_id) throw new Error('Autopay is not enabled for this customer.');
  const method = overview.methods.find(m => Number(m.id) === Number(overview.autopay.payment_method_id));
  if (!method) throw new Error('Autopay payment method not found.');
  const paid = await repo.getInvoicePaidAmount(overviewInvoice.id);
  const amount = amountDue(overviewInvoice, paid);
  if (overview.autopay.max_charge_amount && amount > Number(overview.autopay.max_charge_amount)) throw new Error('Invoice exceeds customer autopay max charge amount.');
  const stripe = getStripe();
  const profile = await repo.getCustomerProfile(overviewInvoice.customer_id);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), currency: 'usd', customer: profile.provider_customer_id,
    payment_method: method.provider_payment_method_id, off_session: true, confirm: true,
    metadata: { internal_invoice_id: String(invoiceId), internal_customer_id: String(overviewInvoice.customer_id), payment_type: method.payment_type }
  });
  const attempt = await repo.createPaymentAttempt({ invoice_id: invoiceId, customer_id: overviewInvoice.customer_id, customer_payment_method_id: method.id, payment_type: method.payment_type, status: 'processing', amount, provider_payment_intent_id: paymentIntent.id, metadata: { autopay: true } });
  if (paymentIntent.status === 'succeeded') {
    await repo.applySucceededPaymentFromAttempt(attempt.id, paymentIntent.id);
    const invoice = await billingRepo.getInvoiceSummary(invoiceId);
    if (invoice) notifications.notifyReceipt(invoice);
  } else {
    await repo.setInvoicePaymentPending(invoiceId);
  }
  return attempt;
}

async function handleStripeWebhook(rawBody, signature) {
  const stripe = getStripe();
  const event = process.env.STRIPE_WEBHOOK_SECRET ? stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET) : JSON.parse(rawBody.toString('utf8'));
  const inserted = await repo.recordProviderEvent(event.id, event.type, event);
  if (!inserted) return { duplicate: true };

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'setup' && session.setup_intent) {
      const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent, { expand: ['payment_method'] });
      const customerId = Number(session.metadata?.internal_customer_id || setupIntent.metadata?.internal_customer_id);
      if (customerId && setupIntent.payment_method) {
        const pm = typeof setupIntent.payment_method === 'string' ? await stripe.paymentMethods.retrieve(setupIntent.payment_method) : setupIntent.payment_method;
        await repo.upsertPaymentMethod(customerId, pm.id, { ...describeStripePaymentMethod(pm), is_default: true });
      }
    }
    if (session.mode === 'payment') {
      const attempt = await repo.updateAttemptByCheckoutSession(session.id, { status: 'processing', provider_payment_intent_id: session.payment_intent || null });
      if (attempt) await repo.setInvoicePaymentPending(attempt.invoice_id);
    }
  }

  if (event.type === 'payment_intent.processing') {
    const pi = event.data.object;
    let attempt = await repo.getAttemptByPaymentIntent(pi.id);
    if (!attempt && pi.metadata?.internal_invoice_id) {
      const invoice = await repo.getInvoiceForOnlinePayment(pi.metadata.internal_invoice_id);
      if (invoice) attempt = await repo.createPaymentAttempt({ invoice_id: invoice.id, customer_id: invoice.customer_id, payment_type: pi.metadata.payment_type || 'card', status: 'processing', amount: Number(pi.amount_received || pi.amount) / 100, provider_payment_intent_id: pi.id, metadata: { webhook_created: true } });
    } else if (attempt && attempt.status !== 'succeeded') {
      attempt = await repo.updateAttemptByPaymentIntent(pi.id, { status: 'processing' });
    }
    if (attempt) await repo.setInvoicePaymentPending(attempt.invoice_id);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    let attempt = await repo.getAttemptByPaymentIntent(pi.id);
    if (!attempt && pi.metadata?.internal_invoice_id) {
      const invoice = await repo.getInvoiceForOnlinePayment(pi.metadata.internal_invoice_id);
      if (invoice) attempt = await repo.createPaymentAttempt({ invoice_id: invoice.id, customer_id: invoice.customer_id, payment_type: pi.metadata.payment_type || 'card', status: 'processing', amount: Number(pi.amount_received || pi.amount) / 100, provider_payment_intent_id: pi.id, metadata: { webhook_created: true } });
    }
    if (attempt) {
      await repo.applySucceededPaymentFromAttempt(attempt.id, pi.id);
      const invoice = await billingRepo.getInvoiceSummary(attempt.invoice_id);
      if (invoice) notifications.notifyReceipt(invoice);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    await repo.markAttemptFailed(pi.id, pi.last_payment_error?.message || 'Payment failed.');
  }

  await repo.markProviderEventProcessed(event.id);
  return { ok: true };
}

async function listInvoiceAttempts(invoiceId) { return repo.listInvoiceAttempts(invoiceId); }

module.exports = { getCustomerPaymentOverview, createSetupCheckoutSession, createInvoiceCardCheckoutSession, setDefaultPaymentMethod, deactivatePaymentMethod, updateAutopay, chargeInvoiceWithSavedMethod, handleStripeWebhook, listInvoiceAttempts };
