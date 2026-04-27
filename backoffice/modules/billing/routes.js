const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('billing/index',{title:'Billing',invoices:await service.listInvoices()});}catch(e){next(e);}});
module.exports=router;
