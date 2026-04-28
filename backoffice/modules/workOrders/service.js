const repo = require('./repository');
const notifications = require('../notifications/service');
function clean(v){ const s=String(v||'').trim(); return s || null; }
async function listWorkOrders(query){return repo.listWorkOrders(query || {});}
async function getWorkOrderFilters(){return repo.getWorkOrderFilters();}
async function getWorkOrderDetail(id){return repo.getWorkOrderDetail(id);}
async function updateWorkOrder(id,body,user){
  await repo.updateWorkOrder(id,{work_order_status_id:Number(body.work_order_status_id),assigned_user_id:body.assigned_user_id?Number(body.assigned_user_id):null,scheduled_start_at:clean(body.scheduled_start_at),quoted_price:body.quoted_price?Number(body.quoted_price):null,final_price:body.final_price?Number(body.final_price):null,reason:clean(body.reason)},user?.id);
  if (body.assigned_user_id) {
    const workOrder = await repo.getWorkOrderDetail(id);
    notifications.notifyWorkOrderAssigned(workOrder);
  }
}
async function transition(id,body,user){return repo.transition(id,body.action,user?.id,clean(body.reason));}
async function addNote(id,userId,note){note=clean(note); if(note) await repo.addNote(id,userId,note);}
async function addLineItem(id,body){
  const description=clean(body.description);
  const quantity=Number(body.quantity || 1);
  const unit_price=body.unit_price === '' || body.unit_price === undefined ? null : Number(body.unit_price);
  const catalog_item_id=body.catalog_item_id?Number(body.catalog_item_id):null;
  if(!description && !catalog_item_id) throw new Error('Line item description is required');
  return repo.addLineItem(id,{catalog_item_id,description,quantity,unit_price});
}
async function deleteLineItem(id,lineItemId){return repo.deleteLineItem(id,lineItemId);}
async function generateInvoice(id,body,user){
  const invoiceId = await repo.generateInvoice(id,user?.id,{description:clean(body.description),total_amount:body.total_amount?Number(body.total_amount):null,notes:clean(body.notes),mark_completed:!!body.mark_completed});
  const workOrder = await repo.getWorkOrderDetail(id);
  notifications.notifyInvoiceGenerated({ invoiceId, workOrder });
  return invoiceId;
}
module.exports={listWorkOrders,getWorkOrderFilters,getWorkOrderDetail,updateWorkOrder,transition,addNote,addLineItem,deleteLineItem,generateInvoice};
