const TECHNICIAN_ROLES = ['technician', 'garage_technician', 'pool_technician', 'screen_technician'];
function requireAuth(req, res, next) { if (req.session.user) return next(); res.redirect(req.app.locals.routePath('/login')); }
function hasRole(user, role) {
  if (!user || !Array.isArray(user.roles)) return false;
  if (role === 'technician') return TECHNICIAN_ROLES.some((r) => user.roles.includes(r));
  return user.roles.includes(role);
}
function hasAnyRole(user, roles = []) { return !!user && Array.isArray(user.roles) && roles.some((role) => hasRole(user, role)); }
function requireRole(role) { return (req, res, next) => hasRole(req.session.user, role) ? next() : res.status(403).send('Forbidden'); }
function requireAnyRole(roles) { return (req, res, next) => hasAnyRole(req.session.user, roles) ? next() : res.status(403).send('Forbidden'); }
function redirectForRole(user, routePath) { return hasRole(user, 'technician') && !hasAnyRole(user, ['admin','finance']) ? routePath('/tech/dashboard') : routePath('/dashboard'); }
module.exports = { requireAuth, requireRole, requireAnyRole, hasRole, hasAnyRole, redirectForRole, TECHNICIAN_ROLES };
