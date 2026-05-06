const express = require('express');
const service = require('./service');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.render('prospects/index', {
      title: 'Prospects',
      prospects: await service.listProspects(req.query),
      filters: req.query,
      users: await service.getUsers()
    });
  } catch (e) { next(e); }
});

router.post('/:id/claim', async (req, res, next) => {
  try {
    await service.claimProspect(req.params.id, req.session.user);
    res.redirect(req.app.locals.routePath('/prospects'));
  } catch (e) { next(e); }
});

router.post('/:id/contacted', async (req, res, next) => {
  try {
    await service.markContacted(req.params.id, req.body, req.session.user);
    res.redirect(req.app.locals.routePath('/prospects'));
  } catch (e) { next(e); }
});

module.exports = router;
