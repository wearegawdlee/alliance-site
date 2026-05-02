const repo=require('./repository');
const notifications=require('../notifications/service');
function clean(v){ const s=String(v||'').trim(); return s||null; }
async function listInvoices(filters){return repo.listInvoices(filters || {});}
async function getPaymentMethods(){return repo.getPaymentMethods();}
async function getInvoiceDetail(id){return repo.getInvoiceDetail(id);}
async function submitInvoice(id){ const invoice=await repo.submitInvoice(id); if(invoice) notifications.notifyInvoiceSubmitted(invoice); return invoice; }
async function recordPayment(id,body){
  const invoice = await repo.recordPayment(id,{payment_method_id:body.payment_method_id?Number(body.payment_method_id):null,amount:body.amount?Number(body.amount):null,reference_number:clean(body.reference_number),notes:clean(body.notes)});
  if (invoice) { notifications.notifyPaymentRecorded(invoice); notifications.notifyReceipt(invoice); }
  return invoice;
}
async function batchSubmitInvoices(invoiceIds){
  const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds].filter(Boolean);
  const submitted = [];
  for (const id of ids) {
    submitted.push(await submitInvoice(id));
  }
  return submitted;
}
module.exports={listInvoices,getPaymentMethods,getInvoiceDetail,submitInvoice,batchSubmitInvoices,recordPayment};
