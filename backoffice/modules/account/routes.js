const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('account/form',{title:'My Account',account:await service.getAccount(req.session.user.id)});}catch(e){next(e);}});
router.post('/',async(req,res,next)=>{try{await service.updateAccount(req.session.user.id,req.body);req.session.user.displayName=req.body.display_name;res.redirect(req.app.locals.routePath('/account'));}catch(e){next(e);}});
module.exports=router;
