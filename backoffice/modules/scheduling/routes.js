const express = require('express');
const service = require('./service');
const recurringService = require('../recurringService/service');
const router = express.Router();

router.get('/calendar', async (req, res, next) => {
  try {
    const calendar = await service.getCalendar(req.query.month);
    res.render('scheduling/calendar', { title: 'Schedule Calendar', calendar });
  } catch (e) { next(e); }
});


router.get('/dispatch', async (req, res, next) => {
  try {
    const board = await service.getDispatchBoard(req.query.week);
    res.render('scheduling/dispatch', { title: 'Dispatch Board', board });
  } catch (e) { next(e); }
});

router.patch('/work-orders/:id/schedule', async (req, res) => {
  try {
    const result = await service.updateWorkOrderSchedule(req.params.id, req.body, req.session.user?.id);
    res.json({ ok: true, workOrder: result });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok: false, error: e.message || 'Could not update work order schedule.' });
  }
});

router.get('/closures', async (req, res, next) => {
  try {
    res.render('scheduling/closures', { title: 'Blackout Dates', closures: await service.listClosures(), options: await service.getOptions() });
  } catch (e) { next(e); }
});

router.post('/closures', async (req, res, next) => {
  try {
    await service.createClosure(req.body);
    req.flash('success', 'Blackout date saved.');
    res.redirect(req.app.locals.routePath('/scheduling/closures'));
  } catch (e) { next(e); }
});

router.post('/closures/:id/delete', async (req, res, next) => {
  try {
    await service.deleteClosure(req.params.id);
    req.flash('success', 'Blackout date removed.');
    res.redirect(req.app.locals.routePath('/scheduling/closures'));
  } catch (e) { next(e); }
});

router.get('/capacity', async (req, res, next) => {
  try {
    res.render('scheduling/capacity', { title: 'Technician Capacity', capacities: await service.listCapacities(), options: await service.getOptions() });
  } catch (e) { next(e); }
});

router.post('/capacity', async (req, res, next) => {
  try {
    await service.upsertCapacity(req.body);
    req.flash('success', 'Technician capacity saved.');
    res.redirect(req.app.locals.routePath('/scheduling/capacity'));
  } catch (e) { next(e); }
});

router.post('/capacity/:id/delete', async (req, res, next) => {
  try {
    await service.deleteCapacity(req.params.id);
    req.flash('success', 'Technician capacity removed.');
    res.redirect(req.app.locals.routePath('/scheduling/capacity'));
  } catch (e) { next(e); }
});

router.post('/generate-recurring', async (req, res, next) => {
  try {
    const result = await recurringService.generateDueWorkOrders({ userId: req.session.user?.id, source: 'admin' });
    req.flash('success', `Recurring generation checked through ${result.horizon}. Created ${result.generated.length} work order(s).`);
    res.redirect(req.app.locals.routePath('/scheduling/calendar'));
  } catch (e) { next(e); }
});

router.get('/', (req, res) => res.redirect(req.app.locals.routePath('/scheduling/calendar')));
module.exports = router;
