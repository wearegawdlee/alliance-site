const repo = require('./repository');
function clean(v){ const s=String(v||'').trim(); return s || null; }
async function listWorkOrders(){return repo.listWorkOrders();}
async function getWorkOrderDetail(id){return repo.getWorkOrderDetail(id);}
async function updateWorkOrder(id,body,user){return repo.updateWorkOrder(id,{work_order_status_id:Number(body.work_order_status_id),assigned_user_id:body.assigned_user_id?Number(body.assigned_user_id):null,scheduled_start_at:clean(body.scheduled_start_at),quoted_price:body.quoted_price?Number(body.quoted_price):null,final_price:body.final_price?Number(body.final_price):null,reason:clean(body.reason)},user?.id);}
async function transition(id,body,user){return repo.transition(id,body.action,user?.id,clean(body.reason));}
async function addNote(id,userId,note){note=clean(note); if(note) await repo.addNote(id,userId,note);}
async function generateInvoice(id,body,user){return repo.generateInvoice(id,user?.id,{description:clean(body.description),total_amount:body.total_amount?Number(body.total_amount):null,notes:clean(body.notes),mark_completed:!!body.mark_completed});}
module.exports={listWorkOrders,getWorkOrderDetail,updateWorkOrder,transition,addNote,generateInvoice};
