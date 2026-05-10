const repo = require('./repository');
function clean(v) { const s = String(v || '').trim(); return s || null; }
function idOrNull(v) { return v === undefined || v === null || v === '' ? null : Number(v); }
async function getCalendar(month) { return repo.getCalendar(month); }
async function getDispatchBoard(week) { return repo.getDispatchBoard(week); }
async function getOptions() { return repo.getOptions(); }
async function listClosures() { return repo.listClosures(); }
async function createClosure(body) { return repo.createClosure({ closure_date: body.closure_date, reason: clean(body.reason) || 'Closed', closure_type: clean(body.closure_type) || 'holiday', service_line_id: idOrNull(body.service_line_id) }); }
async function deleteClosure(id) { return repo.deleteClosure(id); }
async function listCapacities() { return repo.listCapacities(); }
async function upsertCapacity(body) { return repo.upsertCapacity({ user_id: Number(body.user_id), service_line_id: idOrNull(body.service_line_id), max_jobs_per_day: Number(body.max_jobs_per_day || 8) }); }
async function deleteCapacity(id) { return repo.deleteCapacity(id); }
async function updateWorkOrderSchedule(workOrderId, body, userId) { return repo.updateWorkOrderSchedule(workOrderId, { scheduled_date: clean(body.scheduled_date), assigned_user_id: body.assigned_user_id }, userId); }
module.exports = { getCalendar, getDispatchBoard, updateWorkOrderSchedule, getOptions, listClosures, createClosure, deleteClosure, listCapacities, upsertCapacity, deleteCapacity };
