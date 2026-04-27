const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('catalog/index',{title:'Catalog',items:await service.listInventory()});}catch(e){next(e);}});
module.exports=router;
