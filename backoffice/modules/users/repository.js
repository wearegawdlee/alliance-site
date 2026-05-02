const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');

async function listUsers(){
  const r=await pool.query(`
    SELECT u.id,u.email,u.display_name,u.position,u.is_active,u.created_at,
      COALESCE(string_agg(DISTINCT r.name, ', ' ORDER BY r.name),'') role_names,
      COALESCE(string_agg(DISTINCT sl.name, ', ' ORDER BY sl.name),'') service_line_names,
      COALESCE(array_agg(DISTINCT r.code) FILTER (WHERE r.code IS NOT NULL),'{}') roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id=u.id
    LEFT JOIN roles r ON r.id=ur.role_id
    LEFT JOIN user_service_lines usl ON usl.user_id=u.id
    LEFT JOIN service_lines sl ON sl.id=usl.service_line_id
    GROUP BY u.id
    ORDER BY u.is_active DESC,u.display_name`);
  return r.rows;
}
async function getRoles(){ const r=await pool.query(`SELECT id,code,name,description FROM roles WHERE is_active=true ORDER BY sort_order,name`); return r.rows; }
async function getServiceLines(){ const r=await pool.query(`SELECT id,code,name FROM service_lines WHERE is_active=true ORDER BY name`); return r.rows; }
async function getUser(id){
  const [u,rs,ss]=await Promise.all([
    pool.query(`SELECT id,email,display_name,position,is_active FROM users WHERE id=$1`,[id]),
    pool.query(`SELECT role_id FROM user_roles WHERE user_id=$1`,[id]),
    pool.query(`SELECT service_line_id FROM user_service_lines WHERE user_id=$1`,[id])
  ]);
  if(!u.rows[0]) return null;
  return {...u.rows[0], role_ids:rs.rows.map(r=>Number(r.role_id)), service_line_ids:ss.rows.map(r=>Number(r.service_line_id))};
}
async function replaceRoles(client,userId,roleIds){ await client.query(`DELETE FROM user_roles WHERE user_id=$1`,[userId]); for(const roleId of [...new Set((Array.isArray(roleIds)?roleIds:[roleIds]).map(Number).filter(Boolean))]) await client.query(`INSERT INTO user_roles(user_id,role_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[userId,roleId]); }
async function replaceServiceLines(client,userId,serviceLineIds){ await client.query(`DELETE FROM user_service_lines WHERE user_id=$1`,[userId]); for(const serviceLineId of [...new Set((Array.isArray(serviceLineIds)?serviceLineIds:[serviceLineIds]).map(Number).filter(Boolean))]) await client.query(`INSERT INTO user_service_lines(user_id,service_line_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[userId,serviceLineId]); }
async function createUser(data){ const client=await pool.connect(); try{ await client.query('BEGIN'); const passwordHash=await bcrypt.hash(data.password||process.env.SEED_USER_PASSWORD||'ChangeMe123!',10); const r=await client.query(`INSERT INTO users(email,password_hash,display_name,position,role,is_active) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[data.email,passwordHash,data.display_name,data.position||null,data.position||'user',data.is_active!==false]); await replaceRoles(client,r.rows[0].id,data.role_ids||[]); await replaceServiceLines(client,r.rows[0].id,data.service_line_ids||[]); await client.query('COMMIT'); return r.rows[0].id; }catch(e){await client.query('ROLLBACK'); throw e;}finally{client.release();} }
async function updateUser(id,data){ const client=await pool.connect(); try{ await client.query('BEGIN'); await client.query(`UPDATE users SET email=$1,display_name=$2,position=$3,role=$4,is_active=$5,updated_at=current_timestamp WHERE id=$6`,[data.email,data.display_name,data.position||null,data.position||'user',data.is_active!==false,id]); if(data.password){ const h=await bcrypt.hash(data.password,10); await client.query(`UPDATE users SET password_hash=$1,updated_at=current_timestamp WHERE id=$2`,[h,id]); } await replaceRoles(client,id,data.role_ids||[]); await replaceServiceLines(client,id,data.service_line_ids||[]); await client.query('COMMIT'); }catch(e){await client.query('ROLLBACK'); throw e;}finally{client.release();} }
module.exports={listUsers,getRoles,getServiceLines,getUser,createUser,updateUser};
