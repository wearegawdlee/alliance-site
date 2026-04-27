const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('workOrders/index',{title:'Work Orders',workOrders:await service.listWorkOrders()});}catch(e){next(e);}});
module.exports=router;
