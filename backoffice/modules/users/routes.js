
const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('users/index',{title:'User Management',users:await service.listUsers()});}catch(e){next(e);}});
router.get('/new',async(req,res,next)=>{try{res.render('users/form',{title:'New User',...(await service.getFormData())});}catch(e){next(e);}});
router.post('/',async(req,res,next)=>{try{const id=await service.createUser(req.body);res.redirect(req.app.locals.routePath('/users/'+id+'/edit'));}catch(e){next(e);}});
router.get('/:id/edit',async(req,res,next)=>{try{const data=await service.getFormData(req.params.id);if(!data.user)return res.status(404).send('User not found');res.render('users/form',{title:'Edit User',...data});}catch(e){next(e);}});
router.post('/:id',async(req,res,next)=>{try{await service.updateUser(req.params.id,req.body);res.redirect(req.app.locals.routePath('/users'));}catch(e){next(e);}});
module.exports=router;
