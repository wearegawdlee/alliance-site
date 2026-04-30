const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
async function getAccount(id){ const r=await pool.query(`SELECT id,email,display_name,position FROM users WHERE id=$1`,[id]); return r.rows[0]||null; }
async function updateAccount(id,data){
  await pool.query(`UPDATE users SET display_name=$1,updated_at=current_timestamp WHERE id=$2`,[data.display_name,id]);
  if(data.password){ const h=await bcrypt.hash(data.password,10); await pool.query(`UPDATE users SET password_hash=$1,updated_at=current_timestamp WHERE id=$2`,[h,id]); }
}
module.exports={getAccount,updateAccount};
