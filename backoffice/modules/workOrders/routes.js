const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{const [workOrders,filters]=await Promise.all([service.listWorkOrders(req.query),service.getWorkOrderFilters()]);res.render('workOrders/index',{title:'Work Orders',workOrders,filters,query:req.query});}catch(e){next(e);}});
router.get('/:id',async(req,res,next)=>{try{const workOrder=await service.getWorkOrderDetail(req.params.id);if(!workOrder)return res.status(404).send('Work order not found');res.render('workOrders/detail',{title:workOrder.title,workOrder});}catch(e){next(e);}});
router.post('/:id',async(req,res,next)=>{try{await service.updateWorkOrder(req.params.id,req.body,req.session.user);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/transition',async(req,res,next)=>{try{await service.transition(req.params.id,req.body,req.session.user);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/notes',async(req,res,next)=>{try{await service.addNote(req.params.id,req.session.user?.id,req.body.note_body);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/line-items',async(req,res,next)=>{try{await service.addLineItem(req.params.id,req.body);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/line-items/:lineItemId/delete',async(req,res,next)=>{try{await service.deleteLineItem(req.params.id,req.params.lineItemId);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
module.exports=router;
