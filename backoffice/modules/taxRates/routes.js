const express = require('express');
const service = require('./service');
const router = express.Router();

router.get('/', async (req, res, next) => {
  try{
    const taxRates = await service.listTaxRates(req.query);
    res.render('taxRates/index', { title: 'Tax Rates', taxRates, query: req.query });
  }catch(err){ next(err); }
});

router.get('/new', async (req, res, next) => {
  try{
    res.render('taxRates/form', { title: 'New Tax Rate', taxRate: null });
  }catch(err){ next(err); }
});

router.post('/', async (req, res, next) => {
  try{
    await service.createTaxRate(req.body);
    res.redirect(req.app.locals.routePath('/tax-rates'));
  }catch(err){ next(err); }
});

router.get('/:id/edit', async (req, res, next) => {
  try{
    const taxRate = await service.getTaxRate(req.params.id);
    if(!taxRate) return res.status(404).send('Tax rate not found');
    res.render('taxRates/form', { title: 'Edit Tax Rate', taxRate });
  }catch(err){ next(err); }
});

router.post('/:id', async (req, res, next) => {
  try{
    await service.updateTaxRate(req.params.id, req.body);
    res.redirect(req.app.locals.routePath('/tax-rates'));
  }catch(err){ next(err); }
});

router.post('/:id/delete', async (req, res, next) => {
  try{
    await service.deleteTaxRate(req.params.id);
    res.redirect(req.app.locals.routePath('/tax-rates'));
  }catch(err){ next(err); }
});

module.exports = router;
