const express=require('express');const service=require('./service');const router=express.Router();
router.get('/',async(req,res,next)=>{try{res.render('workOrders/index',{title:'Work Orders',workOrders:await service.listWorkOrders()});}catch(e){next(e);}});
router.get('/:id',async(req,res,next)=>{try{const workOrder=await service.getWorkOrderDetail(req.params.id);if(!workOrder)return res.status(404).send('Work order not found');res.render('workOrders/detail',{title:workOrder.title,workOrder});}catch(e){next(e);}});
router.post('/:id',async(req,res,next)=>{try{await service.updateWorkOrder(req.params.id,req.body,req.session.user);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/transition',async(req,res,next)=>{try{await service.transition(req.params.id,req.body,req.session.user);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/notes',async(req,res,next)=>{try{await service.addNote(req.params.id,req.session.user?.id,req.body.note_body);res.redirect(req.app.locals.routePath(`/work-orders/${req.params.id}`));}catch(e){next(e);}});
router.post('/:id/invoices',async(req,res,next)=>{try{const invoiceId=await service.generateInvoice(req.params.id,req.body,req.session.user);res.redirect(req.app.locals.routePath(`/billing`));}catch(e){next(e);}});
module.exports=router;
