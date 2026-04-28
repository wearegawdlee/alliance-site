const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('billing/index',{title:'Billing',invoices:await service.listInvoices(),paymentMethods:await service.getPaymentMethods()});}catch(e){next(e);}});
router.post('/invoices/:id/payments',async(req,res,next)=>{try{await service.recordPayment(req.params.id,req.body);res.redirect(req.app.locals.routePath('/billing'));}catch(e){next(e);}});
module.exports=router;
