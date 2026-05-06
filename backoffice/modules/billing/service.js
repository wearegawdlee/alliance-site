const repo=require('./repository');
const notifications=require('../notifications/service');
const paymentsService=require('../payments/service');
const publicPayments=require('../publicPayments/service');
function clean(v){ const s=String(v||'').trim(); return s||null; }
async function listInvoices(filters){return repo.listInvoices(filters || {});}
async function getPaymentMethods(){return repo.getPaymentMethods();}
async function getInvoiceDetail(id){ const detail=await repo.getInvoiceDetail(id); detail.paymentAttempts=detail.invoice ? await paymentsService.listInvoiceAttempts(id) : []; return detail; }
async function submitInvoice(id){
  const invoice=await repo.submitInvoice(id);
  if(invoice){
    const token = await publicPayments.ensureInvoicePaymentToken(invoice.id);
    const invoiceWithLink = { ...invoice, public_payment_url: publicPayments.publicPayUrl(token) };
    notifications.notifyInvoiceSubmitted(invoiceWithLink);
    notifications.notifyCustomerInvoiceSubmitted(invoiceWithLink);
  }
  return invoice;
}
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
