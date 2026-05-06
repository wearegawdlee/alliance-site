const repo = require('./repository');
const recurringService = require('../recurringService/service');
function toArray(value){ if(!value) return []; return Array.isArray(value)?value:[value]; }
function clean(value){ const v=String(value||'').trim(); return v || null; }
function normalizeCustomer(body,user){return {display_name: clean(body.display_name),customer_status_id: body.customer_status_id ? Number(body.customer_status_id) : null,lead_source_id: body.lead_source_id?Number(body.lead_source_id):null,assigned_user_id: body.assigned_user_id?Number(body.assigned_user_id):null,company_name: clean(body.company_name),notes_summary: clean(body.notes_summary),first_name: clean(body.first_name),last_name: clean(body.last_name),phone: clean(body.phone),email: clean(body.email),preferred_contact_method: clean(body.preferred_contact_method),property_type_id: body.property_type_id?Number(body.property_type_id):null,location_label: clean(body.location_label)||'Service Location',address_line_1: clean(body.address_line_1),gate_code: clean(body.gate_code),access_notes: clean(body.access_notes),city: clean(body.city),state: clean(body.state)||'GA',postal_code: clean(body.postal_code),county: clean(body.county),service_line_ids: toArray(body.service_line_ids).map(Number).filter(Boolean),initial_note: clean(body.initial_note),author_user_id: user && user.id};}
async function listCustomers(filters){return repo.listCustomers(filters || {});}
async function getCustomerDetail(id){return repo.getCustomerDetail(id);}
async function getFormOptions(){return repo.getFormOptions();}
async function createCustomer(body,user){return repo.createCustomer(normalizeCustomer(body,user));}
async function updateCustomer(id,body,user){return repo.updateCustomer(id,normalizeCustomer(body,user));}
async function deleteCustomer(id,user){return repo.deleteCustomer(id,user?.id);}
async function transitionCustomer(id,body,user){return repo.transitionCustomer(id,body.action,user?.id,clean(body.reason));}
function bool(value) { return value === true || value === 'on' || value === 'true' || value === '1'; }
function scheduledDate(value) {
  const v = clean(value);
  if (!v) return null;
  return v.slice(0, 10);
}
async function createWorkOrderFromCustomer(customerId,body,user){
  const title=clean(body.title);
  if(!title) throw new Error('Work order title is required.');

  const workOrderData = {
    title,
    description:clean(body.description),
    service_line_id:Number(body.service_line_id),
    work_order_type_id:body.work_order_type_id?Number(body.work_order_type_id):null,
    customer_location_id:body.customer_location_id?Number(body.customer_location_id):null,
    asset_id:body.asset_id?Number(body.asset_id):null,
    assigned_user_id:body.assigned_user_id?Number(body.assigned_user_id):null,
    scheduled_start_at:clean(body.scheduled_start_at),
    quoted_price:body.quoted_price?Number(body.quoted_price):null
  };

  if (!bool(body.is_recurring)) {
    return repo.createWorkOrderFromCustomer(customerId, workOrderData, user?.id);
  }

  if (!workOrderData.customer_location_id) {
    throw new Error('Recurring work requires a service location.');
  }

  const firstRunDate = scheduledDate(body.scheduled_start_at) || clean(body.next_run_date);
  if (!firstRunDate) {
    throw new Error('Recurring work requires a scheduled start date.');
  }

  // The first generated visit is the work order being created right now.
  // The recurring plan points at the next future occurrence, so "Generate Next"
  // never duplicates the original work order date.
  if (!workOrderData.scheduled_start_at) {
    workOrderData.scheduled_start_at = firstRunDate;
  }

  const workOrderId = await repo.createWorkOrderFromCustomer(customerId, workOrderData, user?.id);
  const nextPlanRunDate = recurringService.nextRunDate({
    frequency: body.frequency || 'weekly',
    interval_count: body.interval_count || 1,
    next_run_date: firstRunDate
  });

  const planId = await recurringService.createPlan({
    customer_id: Number(customerId),
    customer_location_id: workOrderData.customer_location_id,
    service_line_id: workOrderData.service_line_id,
    work_order_type_id: workOrderData.work_order_type_id,
    assigned_user_id: workOrderData.assigned_user_id,
    title,
    description: workOrderData.description,
    frequency: body.frequency || 'weekly',
    interval_count: body.interval_count || 1,
    day_of_week: body.day_of_week || null,
    day_of_month: body.day_of_month || null,
    next_run_date: nextPlanRunDate,
    is_active: true
  });

  await recurringService.recordExistingWorkOrderRun(planId, workOrderId, firstRunDate, user);
  return workOrderId;
}
async function upsertCustomerPricing(customerId,body,user){
  return repo.upsertCustomerPricing(customerId,{ catalog_item_id: body.catalog_item_id, override_unit_price: body.override_unit_price, reason: clean(body.reason) },user?.id);
}
async function deleteCustomerPricing(customerId,pricingId,user){return repo.deleteCustomerPricing(customerId,pricingId,user?.id);}
async function addNote(customerId,userId,note){note=String(note||'').trim(); if(note) await repo.addNote(customerId,userId,note);}
module.exports={listCustomers,getCustomerDetail,getFormOptions,createCustomer,updateCustomer,deleteCustomer,transitionCustomer,createWorkOrderFromCustomer,addNote,upsertCustomerPricing,deleteCustomerPricing};
