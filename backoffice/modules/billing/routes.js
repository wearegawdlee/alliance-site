const express = require('express');
const service = require('./service');
const paymentsService = require('../payments/service');
const publicPayments = require('../publicPayments/service');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'unpaid';
    res.render('billing/index', {
      title: 'Billing',
      statusFilter: status,
      invoices: await service.listInvoices({ status })
    });
  } catch (e) {
    next(e);
  }
});

router.get('/invoices/:id/pdf', async (req, res, next) => {
  try {
    const token = await publicPayments.ensureInvoicePaymentToken(req.params.id);
    const publicPaymentUrl = publicPayments.publicPayUrl(token);
    const pdf = await service.getInvoicePdfBuffer(req.params.id, publicPaymentUrl);
    if (!pdf) return res.status(404).send('Invoice not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pdf.filename}"`);
    res.send(pdf.content);
  } catch (e) {
    next(e);
  }
});

router.get('/invoices/:id', async (req, res, next) => {
  try {
    if (req.query.session_id) {
      await paymentsService.reconcileCheckoutSession(req.query.session_id);
      if (req.flash) req.flash('success', 'Stripe payment was reconciled successfully.');
    }
    const invoice = await service.getInvoiceDetail(req.params.id);
    if (!invoice.invoice) return res.status(404).send('Invoice not found');
    res.render('billing/detail', {
      title: invoice.invoice.invoice_number || 'Invoice',
      invoice,
      paymentMethods: await service.getPaymentMethods()
    });
  } catch (e) {
    next(e);
  }
});

router.post('/invoices/:id/submit', async (req, res) => {
  try {
    const invoice = await service.submitInvoice(req.params.id);
    const label = invoice?.invoice_number || `#${req.params.id}`;
    req.flash('success', `Invoice ${label} was sent successfully.`);
  } catch (e) {
    req.flash('error', `Invoice could not be sent: ${e.message}`);
  }
  res.redirect(req.app.locals.routePath(`/billing/invoices/${req.params.id}`));
});

router.post('/invoices/batch-submit', async (req, res) => {
  const invoiceIds = req.body.invoice_ids || [];
  const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds].filter(Boolean);
  const statusFilter = encodeURIComponent(req.body.status_filter || 'unpaid');

  try {
    await service.batchSubmitInvoices(ids);
    req.flash('success', ids.length === 1 ? 'Invoice was sent successfully.' : `${ids.length} invoices were sent successfully.`);
  } catch (e) {
    req.flash('error', `Invoices could not be sent: ${e.message}`);
  }

  res.redirect(req.app.locals.routePath(`/billing?status=${statusFilter}`));
});

router.post('/invoices/:id/payments', async (req, res) => {
  try {
    await service.recordPayment(req.params.id, req.body);
    req.flash('success', 'Payment was recorded successfully.');
  } catch (e) {
    req.flash('error', `Payment could not be recorded: ${e.message}`);
  }
  res.redirect(req.app.locals.routePath(`/billing/invoices/${req.params.id}`));
});

module.exports = router;
