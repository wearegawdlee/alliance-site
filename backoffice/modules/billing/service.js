const repo=require('./repository');
function clean(v){ const s=String(v||'').trim(); return s||null; }
async function listInvoices(){return repo.listInvoices();}
async function getPaymentMethods(){return repo.getPaymentMethods();}
async function recordPayment(id,body){return repo.recordPayment(id,{payment_method_id:body.payment_method_id?Number(body.payment_method_id):null,amount:body.amount?Number(body.amount):null,reference_number:clean(body.reference_number),notes:clean(body.notes)});}
module.exports={listInvoices,getPaymentMethods,recordPayment};
