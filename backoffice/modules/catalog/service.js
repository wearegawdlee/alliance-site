const repo=require('./repository');
async function listCatalogItems(){return repo.listCatalogItems();}
module.exports={listCatalogItems};
