const express = require('express');
const techService = require('./service');
const workOrderService = require('../workOrders/service');
const paymentsService = require('../payments/service');
const publicPaymentsService = require('../publicPayments/service');
const router = express.Router();

router.get('/', (req, res) => res.redirect(req.app.locals.routePath('/tech/dashboard')));

router.get('/dashboard', async (req, res, next) => {
  try {
    res.render('tech/dashboard', {
      title: 'My Jobs',
      dashboard: await techService.getTechnicianDashboard(req.session.user.id)
    });
  } catch (e) { next(e); }
});

router.get('/work-orders/:id', async (req, res, next) => {
  try {
    const workOrder = await techService.getAssignedWorkOrderDetail(req.params.id, req.session.user);
    if (!workOrder) return res.status(404).send('Work order not found');

    let customerPaymentLink = null;
    if (workOrder.invoice_id && workOrder.invoice_status_code !== 'paid') {
      const token = await publicPaymentsService.ensureInvoicePaymentToken(workOrder.invoice_id);
      customerPaymentLink = publicPaymentsService.publicPayUrl(req, token);
    }

    res.render('tech/work-order', {
      title: workOrder.title,
      workOrder,
      query: req.query,
      customerPaymentLink
    });
  } catch (e) { next(e); }
});

router.post('/work-orders/:id/line-items', async (req, res, next) => {
  try {
    const workOrder = await techService.getAssignedWorkOrderDetail(req.params.id, req.session.user);
    if (!workOrder) return res.status(404).send('Work order not found');
    await workOrderService.addLineItem(req.params.id, req.body);
    res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}`));
  } catch (e) { next(e); }
});

router.post('/work-orders/:id/notes', async (req, res, next) => {
  try {
    const workOrder = await techService.getAssignedWorkOrderDetail(req.params.id, req.session.user);
    if (!workOrder) return res.status(404).send('Work order not found');
    await workOrderService.addNote(req.params.id, req.session.user?.id, req.body.note_body);
    res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}`));
  } catch (e) { next(e); }
});

router.post('/work-orders/:id/complete', async (req, res, next) => {
  try {
    const workOrder = await techService.getAssignedWorkOrderDetail(req.params.id, req.session.user);
    if (!workOrder) return res.status(404).send('Work order not found');
    await workOrderService.transition(req.params.id, { action: 'complete', reason: req.body.reason || 'Completed from technician view' }, req.session.user);
    res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}`));
  } catch (e) { next(e); }
});

router.post('/work-orders/:id/collect-payment', async (req, res, next) => {
  try {
    const workOrder = await techService.getAssignedWorkOrderDetail(req.params.id, req.session.user);
    if (!workOrder) return res.status(404).send('Work order not found');
    if (!workOrder.lineItems.length) return res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}?payment=missing_items`));

    const invoiceId = await workOrderService.ensureInvoiceForWorkOrder(req.params.id, req.session.user);
    if (!invoiceId) return res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}?payment=missing_items`));

    const url = await paymentsService.createInvoiceCardCheckoutSession(req, invoiceId, {
      successPath: `/tech/work-orders/${req.params.id}?payment=success`,
      cancelPath: `/tech/work-orders/${req.params.id}?payment=cancelled`,
      metadata: {
        mobile_field_collection: 'true',
        work_order_id: String(req.params.id),
        collected_by_user_id: String(req.session.user?.id || '')
      }
    });
    res.redirect(url);
  } catch (e) { next(e); }
});

router.post('/work-orders/:id/customer-payment-page', async (req, res, next) => {
  try {
    const workOrder = await techService.getAssignedWorkOrderDetail(req.params.id, req.session.user);
    if (!workOrder) return res.status(404).send('Work order not found');
    if (!workOrder.lineItems.length) return res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}?payment=missing_items`));

    const invoiceId = await workOrderService.ensureInvoiceForWorkOrder(req.params.id, req.session.user);
    if (!invoiceId) return res.redirect(req.app.locals.routePath(`/tech/work-orders/${req.params.id}?payment=missing_items`));

    const token = await publicPaymentsService.ensureInvoicePaymentToken(invoiceId);
    res.redirect(`/pay/i/${token}`);
  } catch (e) { next(e); }
});

module.exports = router;
