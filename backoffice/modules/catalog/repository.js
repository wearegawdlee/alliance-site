const pool=require('../../db/pool');
async function listInventory(){const r=await pool.query(`SELECT ii.*,sl.name service_line FROM inventory_items ii LEFT JOIN service_lines sl ON sl.id=ii.service_line_id ORDER BY ii.name`);return r.rows;}
module.exports={listInventory};
