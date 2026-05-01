const repo = require('./repository');
const workOrderService = require('../workOrders/service');
function hasAnyRole(user, roles) { return !!user && Array.isArray(user.roles) && roles.some((role) => user.roles.includes(role)); }
async function getTechnicianDashboard(userId) { return repo.getTechnicianDashboard(userId); }
async function getAssignedWorkOrderDetail(workOrderId, user) {
  if (!hasAnyRole(user, ['admin', 'finance'])) {
    const assigned = await repo.isAssignedToWorkOrder(workOrderId, user.id);
    if (!assigned) return null;
  }
  return workOrderService.getWorkOrderDetail(workOrderId);
}
module.exports = { getTechnicianDashboard, getAssignedWorkOrderDetail };
