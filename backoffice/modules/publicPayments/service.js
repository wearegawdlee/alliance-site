const crypto = require('crypto');
const repo = require('./repository');
const paymentsService = require('../payments/service');
const { generateInvoicePdf, invoicePdfFilename } = require('../invoices/pdf');

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function publicBaseUrl(req) {
  const fallback = req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:3001';
  return (process.env.PUBLIC_SITE_URL || process.env.APP_PUBLIC_URL || fallback).replace(/\/+$/, '');
}

function publicPayUrl(reqOrToken, maybeToken) {
  if (maybeToken === undefined) return `${publicBaseUrl(null)}/pay/i/${reqOrToken}`;
  return `${publicBaseUrl(reqOrToken)}/pay/i/${maybeToken}`;
}

async function ensureInvoicePaymentToken(invoiceId) {
  return repo.ensureInvoicePaymentToken(invoiceId, newToken());
}

async function getInvoiceByToken(token) {
  return repo.getInvoiceByToken(token);
}

async function lookupInvoice(data) {
  const found = await repo.findInvoiceForLookup(data);
  if (!found) return null;
  if (found.public_payment_token) return found.public_payment_token;
  return ensureInvoicePaymentToken(found.id);
}

async function createLookupToken(data) {
  const identity = String(data.identity || '').trim();
  if (!identity) throw new Error('Email or phone number is required.');
  const token = newToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await repo.createLookupToken({
    identity,
    invoiceNumber: data.invoiceNumber || data.invoice_number || null,
    token,
    expiresAt
  });
  return token;
}

async function getLookupResults(token) {
  const results = await repo.findUnpaidInvoicesForLookupToken(token);
  if (!results) return null;

  for (const invoice of results.invoices) {
    if (!invoice.public_payment_token) {
      invoice.public_payment_token = await ensureInvoicePaymentToken(invoice.id);
    }
  }

  return results;
}


async function getInvoicePdfByToken(token) {
  const detail = await repo.getInvoiceByToken(token);
  if (!detail) return null;
  const content = await generateInvoicePdf(detail, { publicPaymentUrl: publicPayUrl(token) });
  return { content, filename: invoicePdfFilename(detail), detail };
}

async function createPublicInvoiceCardCheckoutSession(req, token) {
  const invoiceId = await repo.getInvoiceIdByToken(token);
  if (!invoiceId) throw new Error('Payment link not found.');
  return paymentsService.createInvoiceCardCheckoutSession(req, invoiceId, {
    successPath: `/pay/success?token=${encodeURIComponent(token)}&session_id={CHECKOUT_SESSION_ID}`,
    cancelPath: `/pay/i/${encodeURIComponent(token)}?payment=cancelled`,
    metadata: { public_payment: 'true' }
  });
}

async function createPublicAutopaySetupSession(req, token, paymentType) {
  const detail = await repo.getInvoiceByToken(token);
  if (!detail) throw new Error('Payment link not found.');
  if (!['card','ach'].includes(paymentType)) throw new Error('Unsupported payment type.');
  return paymentsService.createSetupCheckoutSession(req, detail.invoice.customer_id, paymentType, {
    successPath: `/pay/autopay/${encodeURIComponent(token)}?setup=success`,
    cancelPath: `/pay/autopay/${encodeURIComponent(token)}?setup=cancelled`,
    metadata: { public_autopay_setup: 'true', public_payment_token: token }
  });
}

async function enableAutopayFromPublicToken(token, body) {
  const detail = await repo.getInvoiceByToken(token);
  if (!detail) throw new Error('Payment link not found.');
  return paymentsService.updateAutopay(detail.invoice.customer_id, body);
}

async function reconcileCheckoutSession(sessionId) {
  return paymentsService.reconcileCheckoutSession(sessionId);
}

async function getAutopayOverview(token) {
  const detail = await repo.getInvoiceByToken(token);
  if (!detail) return null;
  const overview = await paymentsService.getCustomerPaymentOverview(detail.invoice.customer_id);
  return { detail, overview };
}

module.exports = {
  ensureInvoicePaymentToken,
  getInvoiceByToken,
  lookupInvoice,
  createLookupToken,
  getLookupResults,
  createPublicInvoiceCardCheckoutSession,
  createPublicAutopaySetupSession,
  enableAutopayFromPublicToken,
  getAutopayOverview,
  reconcileCheckoutSession,
  getInvoicePdfByToken,
  publicPayUrl
};
