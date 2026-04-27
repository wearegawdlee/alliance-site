require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const users=[['jay@local.gdor','Jay','owner'],['zundra@local.gdor','Zundra','admin'],['adriana@local.gdor','Adriana','office'],['denise@local.gdor','Denise','marketing'],['deji@local.gdor','Deji','helper']];
async function run(){const hash=await bcrypt.hash(process.env.SEED_USER_PASSWORD||'ChangeMe123!',10);for(const [email,name,role] of users){await pool.query(`INSERT INTO users(email,password_hash,display_name,role,is_active) VALUES($1,$2,$3,$4,true) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name,role=EXCLUDED.role,is_active=true,updated_at=CURRENT_TIMESTAMP`,[email,hash,name,role]);}console.log('Seeded users');await pool.end();}
run().catch(async e=>{console.error(e);await pool.end();process.exit(1);});
