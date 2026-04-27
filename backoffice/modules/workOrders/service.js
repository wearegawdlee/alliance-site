const repo=require('./repository');
async function listWorkOrders(){return repo.listWorkOrders();}
module.exports={listWorkOrders};
