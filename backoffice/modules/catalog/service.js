const repo=require('./repository');
function clean(v){ const s=String(v||'').trim(); return s || null; }
function slug(v){ return String(v||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || null; }
function money(v){ return v === undefined || v === null || v === '' ? 0 : Number(v); }
function numberOrNull(v){ return v === undefined || v === null || v === '' ? null : Number(v); }
function bool(v){ return v === '1' || v === 'true' || v === 'on' || v === true; }
function itemPayload(body){
  return {
    service_line_id: numberOrNull(body.service_line_id),
    catalog_category_id: numberOrNull(body.catalog_category_id),
    sku: clean(body.sku),
    name: clean(body.name),
    description: clean(body.description),
    item_type: clean(body.item_type) || 'service',
    unit_price: money(body.unit_price),
    cost: body.cost === '' || body.cost === undefined ? null : Number(body.cost),
    is_active: bool(body.is_active)
  };
}
function categoryPayload(body){
  const name=clean(body.name);
  return {
    service_line_id: numberOrNull(body.service_line_id),
    code: clean(body.code) || slug(name),
    name,
    description: clean(body.description),
    sort_order: body.sort_order === '' || body.sort_order === undefined ? 0 : Number(body.sort_order),
    is_active: bool(body.is_active)
  };
}
async function listCatalogItems(query){return repo.listCatalogItems(query||{});}
async function listCatalogCategories(query){return repo.listCatalogCategories(query||{});}
async function getCatalogOptions(){return repo.getCatalogOptions();}
async function getCatalogItem(id){return repo.getCatalogItem(id);}
async function getCatalogCategory(id){return repo.getCatalogCategory(id);}
async function createCatalogItem(body){const data=itemPayload(body); if(!data.name) throw new Error('Catalog item name is required'); return repo.createCatalogItem(data);}
async function updateCatalogItem(id,body){const data=itemPayload(body); if(!data.name) throw new Error('Catalog item name is required'); return repo.updateCatalogItem(id,data);}
async function createCatalogCategory(body){const data=categoryPayload(body); if(!data.service_line_id) throw new Error('Service line is required'); if(!data.name) throw new Error('Category name is required'); if(!data.code) throw new Error('Category code is required'); return repo.createCatalogCategory(data);}
async function updateCatalogCategory(id,body){const data=categoryPayload(body); if(!data.service_line_id) throw new Error('Service line is required'); if(!data.name) throw new Error('Category name is required'); if(!data.code) throw new Error('Category code is required'); return repo.updateCatalogCategory(id,data);}
async function deleteCatalogCategory(id){return repo.deleteCatalogCategory(id);}
async function deleteCatalogItem(id){return repo.deleteCatalogItem(id);}
module.exports={listCatalogItems,listCatalogCategories,getCatalogOptions,getCatalogItem,getCatalogCategory,createCatalogItem,updateCatalogItem,createCatalogCategory,updateCatalogCategory,deleteCatalogCategory,deleteCatalogItem};
