const express = require('express');
const service = require('./service');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('stripeSandbox/index', {
    title: 'Stripe Sandbox',
    status: service.getStatus(),
    result: null,
    error: null,
  });
});

router.post('/charges', runAction('List Charges', async (req) => service.listCharges(req.body.limit)));
router.post('/balance', runAction('Retrieve Balance', async () => service.retrieveBalance()));
router.post('/customers', runAction('List Customers', async (req) => service.listCustomers(req.body.limit)));
router.post('/customers/create', runAction('Create Customer', async (req) => service.createCustomer(req.body)));
router.post('/payment-intents/create', runAction('Create Payment Intent', async (req) => service.createPaymentIntent(req.body)));
router.post('/payment-intents/retrieve', runAction('Retrieve Payment Intent', async (req) => service.retrievePaymentIntent(req.body.paymentIntentId)));

function runAction(action, handler) {
  return async (req, res) => {
    try {
      const data = await handler(req);
      res.render('stripeSandbox/index', {
        title: 'Stripe Sandbox',
        status: service.getStatus(),
        result: { action, data },
        error: null,
      });
    } catch (e) {
      res.status(400).render('stripeSandbox/index', {
        title: 'Stripe Sandbox',
        status: service.getStatus(),
        result: null,
        error: e.message || 'Stripe sandbox request failed.',
      });
    }
  };
}

module.exports = router;
