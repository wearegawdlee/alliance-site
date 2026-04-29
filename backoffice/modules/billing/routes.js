const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('billing/index',{title:'Billing',invoices:await service.listInvoices(),paymentMethods:await service.getPaymentMethods()});}catch(e){next(e);}});
router.get('/invoices/:id',async(req,res,next)=>{try{const invoice=await service.getInvoiceDetail(req.params.id);if(!invoice.invoice)return res.status(404).send('Invoice not found');res.render('billing/detail',{title:invoice.invoice.invoice_number||'Invoice',invoice,paymentMethods:await service.getPaymentMethods()});}catch(e){next(e);}});
router.post('/invoices/:id/submit',async(req,res,next)=>{try{await service.submitInvoice(req.params.id);res.redirect(req.app.locals.routePath(`/billing/invoices/${req.params.id}`));}catch(e){next(e);}});
router.post('/invoices/:id/payments',async(req,res,next)=>{try{await service.recordPayment(req.params.id,req.body);res.redirect(req.app.locals.routePath(`/billing/invoices/${req.params.id}`));}catch(e){next(e);}});
module.exports=router;
