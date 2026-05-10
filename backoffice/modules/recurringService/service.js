const repo=require('./repository');
function clean(v){ const s=String(v||'').trim(); return s || null; }
function parseIntOrNull(v){ return v === undefined || v === null || v === '' ? null : Number(v); }
function normalize(body){ return { customer_id:Number(body.customer_id), customer_location_id:Number(body.customer_location_id), service_line_id:Number(body.service_line_id), work_order_type_id:parseIntOrNull(body.work_order_type_id), assigned_user_id:parseIntOrNull(body.assigned_user_id), title:clean(body.title), description:clean(body.description), frequency:body.frequency||'weekly', interval_count:Number(body.interval_count||1), day_of_week:parseIntOrNull(body.day_of_week), day_of_month:parseIntOrNull(body.day_of_month), next_run_date:body.next_run_date, is_active:!!body.is_active }; }
function sameDate(a,b){ if(!a&&!b)return true; if(!a||!b)return false; return repo.dateOnly(a)===repo.dateOnly(b); }
function cadenceChanged(current,data){ return String(current.frequency||'weekly')!==String(data.frequency||'weekly') || Number(current.interval_count||1)!==Number(data.interval_count||1) || Number(current.day_of_week||0)!==Number(data.day_of_week||0) || Number(current.day_of_month||0)!==Number(data.day_of_month||0); }
async function listPlans(q){return repo.listPlans(q||{});}
async function getOptions(){return repo.getOptions();}
async function getCustomerLocations(customerId){return repo.getCustomerLocations(customerId);}
async function getPlan(id){return repo.getPlan(id);}
async function createPlan(body){return repo.createPlan(normalize(body));}
async function updatePlan(id,body){
  const data=normalize(body);
  const current=await repo.getPlanScheduleSnapshot(id);
  if(!current) throw new Error('Recurring service plan not found');

  // If the cadence changes but the user did not manually choose a new next run date,
  // recalculate from the last generated run. Example: weekly plan generated 5/7 has
  // next_run_date 5/14; editing it to monthly should move next_run_date to 6/7.
  if(cadenceChanged(current,data) && sameDate(data.next_run_date,current.next_run_date)){
    const latestRunDate=await repo.getLatestRunDate(id);
    if(latestRunDate){
      data.next_run_date=repo.nextRunDateFromDate(data,latestRunDate);
    }
  }
  return repo.updatePlan(id,data);
}
async function generateNextWorkOrder(id,user){return repo.generateNextWorkOrder(id,user?.id,'manual');}
async function generateDueWorkOrders(options){return repo.generateDueWorkOrders(options||{});}
async function recordExistingWorkOrderRun(planId,workOrderId,scheduledFor,user){return repo.recordExistingWorkOrderRun(planId,workOrderId,scheduledFor,user?.id);}
function nextRunDate(body){return repo.nextRunDate(normalize(body));}
function dateOnly(value){return repo.dateOnly(value);}
module.exports={listPlans,getOptions,getCustomerLocations,getPlan,createPlan,updatePlan,generateNextWorkOrder,generateDueWorkOrders,recordExistingWorkOrderRun,nextRunDate,dateOnly};
