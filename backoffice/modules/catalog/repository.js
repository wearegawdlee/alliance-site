const pool = require('../../db/pool');

function like(value){ const q=String(value||'').trim(); return q ? `%${q}%` : null; }

async function listCatalogItems(filters={}){
  const params=[]; const where=[];
  const search=like(filters.search);
  if(search){ params.push(search); where.push(`(ci.sku ILIKE $${params.length} OR ci.name ILIKE $${params.length} OR ci.description ILIKE $${params.length} OR ci.item_type ILIKE $${params.length})`); }
  if(filters.service_line_id){ params.push(Number(filters.service_line_id)); where.push(`ci.service_line_id=$${params.length}`); }
  if(filters.item_type){ params.push(String(filters.item_type)); where.push(`ci.item_type=$${params.length}`); }
  if(filters.active === 'active') where.push(`ci.is_active=true`);
  if(filters.active === 'inactive') where.push(`ci.is_active=false`);
  const r = await pool.query(`SELECT ci.*, sl.name service_line FROM catalog_items ci LEFT JOIN service_lines sl ON sl.id=ci.service_line_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ci.is_active DESC, ci.name`, params);
  return r.rows;
}

async function getCatalogOptions(){
  const serviceLines = await pool.query(`SELECT id,name FROM service_lines WHERE is_active=true ORDER BY name`);
  return { serviceLines: serviceLines.rows, itemTypes: ['service','labor','part','material','fee'] };
}

async function getCatalogItem(id){
  const r=await pool.query(`SELECT * FROM catalog_items WHERE id=$1`,[id]);
  return r.rows[0] || null;
}

async function createCatalogItem(data){
  const r=await pool.query(`INSERT INTO catalog_items(service_line_id,sku,name,description,item_type,unit_price,cost,is_active) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[data.service_line_id,data.sku,data.name,data.description,data.item_type,data.unit_price,data.cost,data.is_active]);
  return r.rows[0].id;
}

async function updateCatalogItem(id,data){
  await pool.query(`UPDATE catalog_items SET service_line_id=$1,sku=$2,name=$3,description=$4,item_type=$5,unit_price=$6,cost=$7,is_active=$8,updated_at=current_timestamp WHERE id=$9`,[data.service_line_id,data.sku,data.name,data.description,data.item_type,data.unit_price,data.cost,data.is_active,id]);
}

async function deleteCatalogItem(id){
  const refs=await pool.query(`SELECT
    (SELECT COUNT(*) FROM work_order_line_items WHERE catalog_item_id=$1)::int AS work_order_count,
    (SELECT COUNT(*) FROM estimate_line_items WHERE catalog_item_id=$1)::int AS estimate_count,
    (SELECT COUNT(*) FROM invoice_line_items WHERE catalog_item_id=$1)::int AS invoice_count`,[id]);
  const total=refs.rows[0].work_order_count + refs.rows[0].estimate_count + refs.rows[0].invoice_count;
  if(total>0){
    await pool.query(`UPDATE catalog_items SET is_active=false,updated_at=current_timestamp WHERE id=$1`,[id]);
    return { archived:true };
  }
  await pool.query(`DELETE FROM catalog_items WHERE id=$1`,[id]);
  return { deleted:true };
}

module.exports={listCatalogItems,getCatalogOptions,getCatalogItem,createCatalogItem,updateCatalogItem,deleteCatalogItem};
