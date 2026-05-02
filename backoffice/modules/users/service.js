const repo=require('./repository');
async function listUsers(){return repo.listUsers();}
async function getFormData(id){const [roles,serviceLines,user]=await Promise.all([repo.getRoles(),repo.getServiceLines(),id?repo.getUser(id):Promise.resolve(null)]);return{roles,serviceLines,user};}
async function createUser(body){return repo.createUser({...body,role_ids:body.role_ids||[],service_line_ids:body.service_line_ids||[],is_active:!!body.is_active});}
async function updateUser(id,body){return repo.updateUser(id,{...body,role_ids:body.role_ids||[],service_line_ids:body.service_line_ids||[],is_active:!!body.is_active});}
module.exports={listUsers,getFormData,createUser,updateUser};
