const express = require('express');
const service = require('./service');
const router = express.Router();

// /pay is mounted before the global body parser so Stripe webhooks can keep their raw body.
// Parse public payment forms locally for this route group.
router.use(express.urlencoded({ extended: true }));

function renderPortal(res, view, data = {}) {
  res.render(`publicPayments/${view}`, { hideSidebar: true, ...data });
}

router.get('/', (req, res) => {
  renderPortal(res, 'index', { title: 'Pay Online', error: null, values: {} });
});

router.post('/lookup', async (req, res, next) => {
  try {
    const identity = String(req.body.identity || '').trim();
    const invoiceNumber = String(req.body.invoice_number || '').trim();

    if (!identity) {
      return renderPortal(res.status(400), 'index', {
        title: 'Pay Online',
        error: 'Enter the email address or phone number on file.',
        values: req.body
      });
    }

    // Optional shortcut: invoice number + identity goes directly to the invoice when it matches.
    if (invoiceNumber) {
      const directToken = await service.lookupInvoice({ invoiceNumber, identity });
      if (directToken) return res.redirect(`/pay/i/${directToken}`);
    }

    const lookupToken = await service.createLookupToken({ identity, invoiceNumber });
    res.redirect(`/pay/results/${lookupToken}`);
  } catch (e) { next(e); }
});

router.get('/results/:lookupToken', async (req, res, next) => {
  try {
    const results = await service.getLookupResults(req.params.lookupToken);
    if (!results) return renderPortal(res.status(404), 'not-found', { title: 'Payment Lookup Expired' });
    renderPortal(res, 'results', { title: 'Unpaid Invoices', results, lookupToken: req.params.lookupToken });
  } catch (e) { next(e); }
});

router.get('/i/:token', async (req, res, next) => {
  try {
    const detail = await service.getInvoiceByToken(req.params.token);
    if (!detail) return renderPortal(res.status(404), 'not-found', { title: 'Payment Link Not Found' });
    renderPortal(res, 'invoice', { title: detail.invoice.invoice_number || 'Invoice', detail, token: req.params.token, query: req.query });
  } catch (e) { next(e); }
});

router.post('/i/:token/card-checkout', async (req, res, next) => {
  try {
    const url = await service.createPublicInvoiceCardCheckoutSession(req, req.params.token);
    res.redirect(url);
  } catch (e) { next(e); }
});

router.get('/autopay/:token', async (req, res, next) => {
  try {
    const data = await service.getAutopayOverview(req.params.token);
    if (!data) return renderPortal(res.status(404), 'not-found', { title: 'Payment Link Not Found' });
    renderPortal(res, 'autopay', { title: 'Set Up Autopay', ...data, token: req.params.token, query: req.query });
  } catch (e) { next(e); }
});

router.post('/autopay/:token/setup/:type', async (req, res, next) => {
  try {
    const url = await service.createPublicAutopaySetupSession(req, req.params.token, req.params.type);
    res.redirect(url);
  } catch (e) { next(e); }
});

router.post('/autopay/:token/settings', async (req, res, next) => {
  try {
    await service.enableAutopayFromPublicToken(req.params.token, req.body);
    res.redirect(`/pay/autopay/${req.params.token}?autopay=updated`);
  } catch (e) { next(e); }
});

router.get('/success', async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) return res.redirect('/pay');
    const detail = await service.getInvoiceByToken(token);
    renderPortal(res, 'success', { title: 'Payment Received', detail, token });
  } catch (e) { next(e); }
});

module.exports = router;
