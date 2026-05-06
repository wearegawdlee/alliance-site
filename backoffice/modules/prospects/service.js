const repo = require('./repository');
function clean(value) { return String(value || '').trim(); }
async function listProspects(filters) { return repo.listProspects(filters || {}); }
async function getUsers() { return repo.getUsers(); }
async function claimProspect(id, user) { return repo.claimProspect(Number(id), user?.id); }
async function markContacted(id, body, user) { return repo.markContacted(Number(id), user?.id, clean(body.note_body)); }
module.exports = { listProspects, getUsers, claimProspect, markContacted };
