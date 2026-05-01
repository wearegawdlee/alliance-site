const pool = require('../../db/pool');

function like(value){ const q=String(value||'').trim(); return q ? `%${q}%` : null; }
function nullNumber(value){ return value === undefined || value === null || value === '' ? null : Number(value); }

async function listCatalogItems(filters={}){
  const params=[]; const where=[];
  const search=like(filters.search);
  if(search){ params.push(search); where.push(`(ci.sku ILIKE $${params.length} OR ci.name ILIKE $${params.length} OR ci.description ILIKE $${params.length} OR ci.item_type ILIKE $${params.length} OR cc.name ILIKE $${params.length})`); }
  if(filters.service_line_id){ params.push(Number(filters.service_line_id)); where.push(`ci.service_line_id=$${params.length}`); }
  if(filters.catalog_category_id){ params.push(Number(filters.catalog_category_id)); where.push(`ci.catalog_category_id=$${params.length}`); }
  if(filters.item_type){ params.push(String(filters.item_type)); where.push(`ci.item_type=$${params.length}`); }
  if(filters.active === 'active') where.push(`ci.is_active=true`);
  if(filters.active === 'inactive') where.push(`ci.is_active=false`);
  const r = await pool.query(`
    SELECT ci.*, sl.name service_line, cc.name category_name, cc.is_active category_is_active
    FROM catalog_items ci
    LEFT JOIN service_lines sl ON sl.id=ci.service_line_id
    LEFT JOIN catalog_categories cc ON cc.id=ci.catalog_category_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ci.is_active DESC, sl.name NULLS LAST, cc.sort_order NULLS LAST, cc.name NULLS LAST, ci.name
  `, params);
  return r.rows;
}

async function listCatalogCategories(filters={}){
  const params=[]; const where=[];
  const search=like(filters.search);
  if(search){ params.push(search); where.push(`(cc.code ILIKE $${params.length} OR cc.name ILIKE $${params.length} OR cc.description ILIKE $${params.length})`); }
  if(filters.service_line_id){ params.push(Number(filters.service_line_id)); where.push(`cc.service_line_id=$${params.length}`); }
  if(filters.active === 'active') where.push(`cc.is_active=true`);
  if(filters.active === 'inactive') where.push(`cc.is_active=false`);
  const r = await pool.query(`
    SELECT cc.*, sl.name service_line, COALESCE(item_counts.item_count,0)::int item_count
    FROM catalog_categories cc
    JOIN service_lines sl ON sl.id=cc.service_line_id
    LEFT JOIN (
      SELECT catalog_category_id, COUNT(*)::int item_count
      FROM catalog_items
      WHERE catalog_category_id IS NOT NULL
      GROUP BY catalog_category_id
    ) item_counts ON item_counts.catalog_category_id=cc.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY sl.name, cc.sort_order, cc.name
  `, params);
  return r.rows;
}

async function getCatalogOptions(){
  const [serviceLines, categories] = await Promise.all([
    pool.query(`SELECT id,name FROM service_lines WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT cc.id,cc.service_line_id,cc.name,cc.code,sl.name service_line FROM catalog_categories cc JOIN service_lines sl ON sl.id=cc.service_line_id WHERE cc.is_active=true AND sl.is_active=true ORDER BY sl.name, cc.sort_order, cc.name`)
  ]);
  return { serviceLines: serviceLines.rows, categories: categories.rows, itemTypes: ['service','labor','part','material','fee'] };
}

async function getCatalogItem(id){
  const r=await pool.query(`SELECT * FROM catalog_items WHERE id=$1`,[id]);
  return r.rows[0] || null;
}

async function getCatalogCategory(id){
  const r=await pool.query(`SELECT * FROM catalog_categories WHERE id=$1`,[id]);
  return r.rows[0] || null;
}

async function createCatalogItem(data){
  const r=await pool.query(`
    INSERT INTO catalog_items(service_line_id,catalog_category_id,sku,name,description,item_type,unit_price,cost,is_active)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING id
  `,[data.service_line_id,data.catalog_category_id,data.sku,data.name,data.description,data.item_type,data.unit_price,data.cost,data.is_active]);
  return r.rows[0].id;
}

async function updateCatalogItem(id,data){
  await pool.query(`
    UPDATE catalog_items
    SET service_line_id=$1,catalog_category_id=$2,sku=$3,name=$4,description=$5,item_type=$6,unit_price=$7,cost=$8,is_active=$9,updated_at=current_timestamp
    WHERE id=$10
  `,[data.service_line_id,data.catalog_category_id,data.sku,data.name,data.description,data.item_type,data.unit_price,data.cost,data.is_active,id]);
}

async function createCatalogCategory(data){
  const r=await pool.query(`
    INSERT INTO catalog_categories(service_line_id,code,name,description,sort_order,is_active)
    VALUES($1,$2,$3,$4,$5,$6)
    RETURNING id
  `,[data.service_line_id,data.code,data.name,data.description,data.sort_order,data.is_active]);
  return r.rows[0].id;
}

async function updateCatalogCategory(id,data){
  await pool.query(`
    UPDATE catalog_categories
    SET service_line_id=$1,code=$2,name=$3,description=$4,sort_order=$5,is_active=$6,updated_at=current_timestamp
    WHERE id=$7
  `,[data.service_line_id,data.code,data.name,data.description,data.sort_order,data.is_active,id]);
}

async function deleteCatalogCategory(id){
  const refs=await pool.query(`SELECT COUNT(*)::int item_count FROM catalog_items WHERE catalog_category_id=$1`,[id]);
  if(refs.rows[0].item_count>0){
    await pool.query(`UPDATE catalog_categories SET is_active=false,updated_at=current_timestamp WHERE id=$1`,[id]);
    return { archived:true };
  }
  await pool.query(`DELETE FROM catalog_categories WHERE id=$1`,[id]);
  return { deleted:true };
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

async function listActiveItemsForServiceLine(serviceLineId){
  const r=await pool.query(`
    SELECT ci.id, ci.sku, ci.name, ci.item_type, ci.unit_price, ci.catalog_category_id, cc.name category_name, sl.name service_line
    FROM catalog_items ci
    LEFT JOIN catalog_categories cc ON cc.id=ci.catalog_category_id
    LEFT JOIN service_lines sl ON sl.id=ci.service_line_id
    WHERE ci.is_active=true
      AND (ci.service_line_id=$1 OR ci.service_line_id IS NULL)
      AND (ci.catalog_category_id IS NULL OR cc.is_active=true)
    ORDER BY cc.sort_order NULLS LAST, cc.name NULLS LAST, ci.name
  `,[serviceLineId]);
  return r.rows;
}

async function listActiveCategoriesForServiceLine(serviceLineId){
  const r=await pool.query(`
    SELECT id, service_line_id, code, name
    FROM catalog_categories
    WHERE is_active=true AND service_line_id=$1
    ORDER BY sort_order, name
  `,[serviceLineId]);
  return r.rows;
}

module.exports={
  listCatalogItems,
  listCatalogCategories,
  getCatalogOptions,
  getCatalogItem,
  getCatalogCategory,
  createCatalogItem,
  updateCatalogItem,
  createCatalogCategory,
  updateCatalogCategory,
  deleteCatalogCategory,
  deleteCatalogItem,
  listActiveItemsForServiceLine,
  listActiveCategoriesForServiceLine,
};
