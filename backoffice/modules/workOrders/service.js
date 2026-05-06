const repo = require('./repository');
const notifications = require('../notifications/service');
function clean(v){ const s=String(v||'').trim(); return s || null; }
async function listWorkOrders(query){return repo.listWorkOrders(query || {});}
async function getWorkOrderFilters(){return repo.getWorkOrderFilters();}
async function getWorkOrderDetail(id){return repo.getWorkOrderDetail(id);}
function moneyOrZero(value) {
  if (value === undefined || value === null || value === '') return 0;
  return Number(value) || 0;
}

async function updateWorkOrder(id,body,user){
  const discountType = clean(body.discount_type);
  const discountValueType = body.discount_value_type === 'percent' ? 'percent' : 'flat';

  await repo.updateWorkOrder(id,{
    assigned_user_id:body.assigned_user_id?Number(body.assigned_user_id):null,
    scheduled_start_at:clean(body.scheduled_start_at),
    scheduled_end_at:clean(body.scheduled_end_at),
    quoted_price:body.quoted_price?Number(body.quoted_price):null,
    final_price:body.final_price?Number(body.final_price):null,
    discount_type: discountType === 'none' ? null : discountType,
    discount_value_type: discountValueType,
    discount_percent: discountValueType === 'percent' ? moneyOrZero(body.discount_percent) : 0,
    discount_amount: discountValueType === 'flat' ? moneyOrZero(body.discount_amount) : 0,
    discount_reason: clean(body.discount_reason),
    deposit_amount: moneyOrZero(body.deposit_amount),
    deposit_note: clean(body.deposit_note),
    reason:clean(body.reason)
  },user?.id);
  if (body.assigned_user_id) {
    const workOrder = await repo.getWorkOrderDetail(id);
    notifications.notifyWorkOrderAssigned(workOrder);
  }
}
async function transition(id,body,user){
  const invoiceId = await repo.transition(id,body.action,user?.id,clean(body.reason));
  if (invoiceId) {
    const workOrder = await repo.getWorkOrderDetail(id);
    notifications.notifyInvoiceGenerated({ invoiceId, workOrder });
  }
  return invoiceId;
}
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
async function ensureInvoiceForWorkOrder(id,user){
  return repo.ensureInvoiceForWorkOrder(id, user?.id, 'Invoice prepared for field payment collection');
}
module.exports={listWorkOrders,getWorkOrderFilters,getWorkOrderDetail,updateWorkOrder,transition,addNote,addLineItem,deleteLineItem,ensureInvoiceForWorkOrder};

