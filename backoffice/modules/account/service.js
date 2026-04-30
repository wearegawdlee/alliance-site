const repo=require('./repository');
function clean(v){const s=String(v||'').trim();return s||null;}
async function getAccount(id){return repo.getAccount(id);}
async function updateAccount(id,body){return repo.updateAccount(id,{display_name:clean(body.display_name),password:clean(body.password)});}
module.exports={getAccount,updateAccount};
