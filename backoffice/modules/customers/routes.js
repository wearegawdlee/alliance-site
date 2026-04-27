const express = require('express');
const service = require('./service');
const router = express.Router();
router.get('/', async (req,res,next)=>{try{res.render('customers/index',{title:'Customers',customers:await service.listCustomers()});}catch(e){next(e);}});
router.get('/new', async (req,res,next)=>{try{res.render('customers/form',{title:'New Customer',options:await service.getFormOptions()});}catch(e){next(e);}});
router.post('/', async (req,res,next)=>{try{const id=await service.createCustomer(req.body,req.session.user);res.redirect(req.app.locals.routePath(`/customers/${id}`));}catch(e){next(e);}});
router.get('/:id', async (req,res,next)=>{try{const customer=await service.getCustomerDetail(req.params.id);if(!customer)return res.status(404).send('Customer not found');res.render('customers/detail',{title:customer.display_name,customer});}catch(e){next(e);}});
router.post('/:id/notes', async (req,res,next)=>{try{await service.addNote(req.params.id,req.session.user?.id,req.body.note_body);res.redirect(req.app.locals.routePath(`/customers/${req.params.id}`));}catch(e){next(e);}});
module.exports = router;
