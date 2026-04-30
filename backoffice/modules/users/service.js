
const repo=require('./repository');
function clean(v){const s=String(v||'').trim();return s||null;}
function parse(body){const roleIds=Array.isArray(body.role_ids)?body.role_ids:(body.role_ids?[body.role_ids]:[]);return{email:clean(body.email),display_name:clean(body.display_name),position:clean(body.position),password:clean(body.password),is_active:body.is_active==='on'||body.is_active==='true'||body.is_active===undefined,role_ids:roleIds.map(Number).filter(Boolean)}}
async function listUsers(){return repo.listUsers();}
async function getFormData(id){const [roles,user]=await Promise.all([repo.getRoles(),id?repo.getUser(id):Promise.resolve(null)]);return{roles,user};}
async function createUser(body){return repo.createUser(parse(body));}
async function updateUser(id,body){return repo.updateUser(id,parse(body));}
module.exports={listUsers,getFormData,createUser,updateUser};
