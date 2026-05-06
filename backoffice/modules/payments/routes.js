const express = require('express');
const service = require('./service');
const { requireAuth, requireAnyRole } = require('../../middleware/auth');
const router = express.Router();

router.use(requireAuth, requireAnyRole(['admin','finance']));

router.get('/customers/:customerId', async (req, res, next) => {
  try {
    const overview = await service.getCustomerPaymentOverview(req.params.customerId);
    if (!overview) return res.status(404).send('Customer not found');
    res.render('payments/customer', { title: `Payments · ${overview.customer.display_name}`, overview, query: req.query });
  } catch (e) { next(e); }
});

router.post('/customers/:customerId/setup/:type', async (req, res, next) => {
  try {
    const url = await service.createSetupCheckoutSession(req, req.params.customerId, req.params.type);
    res.redirect(url);
  } catch (e) { next(e); }
});

router.post('/customers/:customerId/methods/:methodId/default', async (req, res, next) => {
  try { await service.setDefaultPaymentMethod(req.params.customerId, req.params.methodId); res.redirect(req.app.locals.routePath(`/payments/customers/${req.params.customerId}`)); } catch (e) { next(e); }
});

router.post('/customers/:customerId/methods/:methodId/delete', async (req, res, next) => {
  try { await service.deactivatePaymentMethod(req.params.customerId, req.params.methodId); res.redirect(req.app.locals.routePath(`/payments/customers/${req.params.customerId}`)); } catch (e) { next(e); }
});

router.post('/customers/:customerId/autopay', async (req, res, next) => {
  try { await service.updateAutopay(req.params.customerId, req.body); res.redirect(req.app.locals.routePath(`/payments/customers/${req.params.customerId}`)); } catch (e) { next(e); }
});

router.post('/invoices/:invoiceId/card-checkout', async (req, res, next) => {
  try { const url = await service.createInvoiceCardCheckoutSession(req, req.params.invoiceId); res.redirect(url); } catch (e) { next(e); }
});

router.post('/invoices/:invoiceId/autopay-charge', async (req, res, next) => {
  try { await service.chargeInvoiceWithSavedMethod(req.params.invoiceId); res.redirect(req.app.locals.routePath(`/billing/invoices/${req.params.invoiceId}`)); } catch (e) { next(e); }
});

module.exports = router;
