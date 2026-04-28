const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{const [items,options]=await Promise.all([service.listCatalogItems(req.query),service.getCatalogOptions()]);res.render('catalog/index',{title:'Catalog',items,options,query:req.query});}catch(e){next(e);}});
router.get('/new',async(req,res,next)=>{try{res.render('catalog/form',{title:'New Catalog Item',item:null,options:await service.getCatalogOptions()});}catch(e){next(e);}});
router.post('/',async(req,res,next)=>{try{const id=await service.createCatalogItem(req.body);res.redirect(req.app.locals.routePath('/catalog'));}catch(e){next(e);}});
router.get('/:id/edit',async(req,res,next)=>{try{const item=await service.getCatalogItem(req.params.id);if(!item)return res.status(404).send('Catalog item not found');res.render('catalog/form',{title:'Edit Catalog Item',item,options:await service.getCatalogOptions()});}catch(e){next(e);}});
router.post('/:id',async(req,res,next)=>{try{await service.updateCatalogItem(req.params.id,req.body);res.redirect(req.app.locals.routePath('/catalog'));}catch(e){next(e);}});
router.post('/:id/delete',async(req,res,next)=>{try{await service.deleteCatalogItem(req.params.id);res.redirect(req.app.locals.routePath('/catalog'));}catch(e){next(e);}});
module.exports=router;
