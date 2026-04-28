const repo=require('./repository');
const notifications=require('../notifications/service');
function clean(v){ const s=String(v||'').trim(); return s||null; }
async function listInvoices(){return repo.listInvoices();}
async function getPaymentMethods(){return repo.getPaymentMethods();}
async function recordPayment(id,body){
  const invoice = await repo.recordPayment(id,{payment_method_id:body.payment_method_id?Number(body.payment_method_id):null,amount:body.amount?Number(body.amount):null,reference_number:clean(body.reference_number),notes:clean(body.notes)});
  if (invoice) notifications.notifyPaymentRecorded(invoice);
  return invoice;
}
module.exports={listInvoices,getPaymentMethods,recordPayment};
