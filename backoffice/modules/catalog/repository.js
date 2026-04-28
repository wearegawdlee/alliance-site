const pool = require('../../db/pool');
async function listCatalogItems(){
  const r = await pool.query(`SELECT ci.*, sl.name service_line FROM catalog_items ci LEFT JOIN service_lines sl ON sl.id=ci.service_line_id ORDER BY ci.name`);
  return r.rows;
}
module.exports={listCatalogItems};
