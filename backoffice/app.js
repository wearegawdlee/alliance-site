const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcryptjs');
const appConfig = require('./config/app-config');
require('dotenv').config();

const userRepository = require('./db/user-repository');
const customerRoutes = require('./modules/customers/routes');
const prospectRoutes = require('./modules/prospects/routes');
const workOrderRoutes = require('./modules/workOrders/routes');
const billingRoutes = require('./modules/billing/routes');
const catalogRoutes = require('./modules/catalog/routes');
const taxRateRoutes = require('./modules/taxRates/routes');
const publicIntakeRoutes = require('./modules/publicIntake/routes');
const dashboardRoutes = require('./modules/dashboard/routes');
const userRoutes = require('./modules/users/routes');
const recurringServiceRoutes = require('./modules/recurringService/routes');
const techRoutes = require('./modules/tech/routes');
const accountRoutes = require('./modules/account/routes');
const paymentRoutes = require('./modules/payments/routes');
const publicPaymentRoutes = require('./modules/publicPayments/routes');
const paymentService = require('./modules/payments/service');
const { requireAuth, requireRole, requireAnyRole, hasRole, hasAnyRole, redirectForRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/backoffice');

app.locals.basePath = BASE_PATH;
app.locals.appConfig = appConfig;
app.locals.routePath = (target = '') => `${BASE_PATH}${normalizeTargetPath(target)}`;
app.locals.assetPath = (target = '') => `${BASE_PATH}${normalizeTargetPath(target)}`;
app.locals.formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
app.locals.formatDate = (value) => value ? new Date(value).toLocaleString() : '—';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));
// Stripe webhook needs the raw body before the generic parsers run.
app.post(app.locals.routePath('/payments/webhook'), express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const result = await paymentService.handleStripeWebhook(req.body, req.headers['stripe-signature']);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(400).send(`Webhook error: ${e.message}`);
  }
});
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: process.env.SESSION_SECRET || 'dev-secret-change-me', resave: false, saveUninitialized: false, cookie: { secure: false } }));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.hasRole = (role) => hasRole(req.session.user, role);
  res.locals.hasAnyRole = (roles) => hasAnyRole(req.session.user, roles);
  res.locals.isTechnicianOnly = hasRole(req.session.user, 'technician') && !hasAnyRole(req.session.user, ['admin', 'finance']);
  next();
});

app.get('/', (req, res) => res.redirect(BASE_PATH || '/'));
app.get(`${BASE_PATH}`, (req, res) => req.session.user ? res.redirect(redirectForRole(req.session.user, app.locals.routePath)) : res.redirect(app.locals.routePath('/login')));
app.get(`${BASE_PATH}/login`, (req, res) => {
  if (req.session.user) return res.redirect(redirectForRole(req.session.user, app.locals.routePath));
  res.render('login', { title: 'Login', hideSidebar: true, error: null });
});
app.post(`${BASE_PATH}/login`, async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userRepository.findActiveUserByEmail(email);
    if (!user) return renderLoginError(res);
    const ok = await bcrypt.compare(password || '', user.password_hash);
    if (!ok) return renderLoginError(res);
    req.session.user = { id: user.id, email: user.email, displayName: user.display_name, position: user.position, role: user.role, roles: user.roles || [], serviceLineIds: user.serviceLineIds || [] };
    req.session.save(err => {
      if (err) { console.error(err); return renderLoginError(res, 'Could not save session. Try again.'); }
      res.redirect(redirectForRole(req.session.user, app.locals.routePath));
    });
  } catch (e) { console.error(e); renderLoginError(res); }
});
app.post(`${BASE_PATH}/logout`, (req, res) => req.session.destroy(() => res.redirect(app.locals.routePath('/login'))));
app.get(`${BASE_PATH}/health`, (req, res) => res.json({ ok: true }));
app.use('/pay', publicPaymentRoutes);

app.use(`${BASE_PATH}/api/public`, publicIntakeRoutes);
app.use(app.locals.routePath('/dashboard'), requireAuth, requireAnyRole(['admin','finance']), dashboardRoutes);
app.get(`${BASE_PATH}/leads`, requireAuth, (req, res) => res.redirect(app.locals.routePath('/prospects')));
app.use(app.locals.routePath('/prospects'), requireAuth, requireAnyRole(['admin','finance']), prospectRoutes);
app.use(app.locals.routePath('/customers'), requireAuth, requireAnyRole(['admin','finance']), customerRoutes);
app.use(app.locals.routePath('/work-orders'), requireAuth, requireAnyRole(['admin','finance','technician']), workOrderRoutes);
app.use(app.locals.routePath('/billing'), requireAuth, requireAnyRole(['admin','finance']), billingRoutes);
app.use(app.locals.routePath('/catalog'), requireAuth, requireAnyRole(['admin','finance']), catalogRoutes);
app.use(app.locals.routePath('/tax-rates'), requireAuth, requireAnyRole(['admin','finance']), taxRateRoutes);
app.use(app.locals.routePath('/recurring-service'), requireAuth, requireAnyRole(['admin','finance']), recurringServiceRoutes);
app.use(app.locals.routePath('/users'), requireAuth, requireRole('admin'), userRoutes);
app.use(app.locals.routePath('/tech'), requireAuth, requireAnyRole(['admin','technician']), techRoutes);
app.use(app.locals.routePath('/payments'), paymentRoutes);
app.use(app.locals.routePath('/account'), requireAuth, accountRoutes);

app.use((err, req, res, next) => { console.error(err); res.status(500).send('Server error'); });

function renderLoginError(res, error = 'Invalid email or password') { return res.status(401).render('login', { title: 'Login', hideSidebar: true, error }); }
function normalizeBasePath(value) { const trimmed = normalizeTargetPath(value); return trimmed === '' ? '' : trimmed; }
function normalizeTargetPath(target) { const t = String(target || '').trim(); if (!t || t === '/') return ''; return (t.startsWith('/') ? t : `/${t}`).replace(/\/+$/, ''); }

if (require.main === module) app.listen(PORT, () => console.log(`${appConfig.brand.backofficeName} listening on http://localhost:${PORT}${BASE_PATH}`));
module.exports = { app, BASE_PATH };
