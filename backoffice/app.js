require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/backoffice');
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace-me-in-production';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const STATUS_OPTIONS = ['new', 'contacted', 'waiting', 'scheduled', 'completed', 'paid', 'lost'];
const SERVICE_TYPE_OPTIONS = ['opener_install', 'opener_programming', 'keypad_remote_programming', 'troubleshooting', 'general_service', 'garage_door_repair', 'unknown'];
const LEAD_SOURCE_OPTIONS = ['website', 'phone', 'google_business', 'facebook', 'thumbtack', 'angi', 'referral', 'other'];

const bcrypt = require('bcryptjs');
const userRepository = require('./db/user-repository');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  name: 'gdor.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use(`${BASE_PATH}/assets`, express.static(path.join(__dirname, 'public')));

app.locals.basePath = BASE_PATH;
app.locals.assetPath = (asset) => `${BASE_PATH}/assets/${String(asset || '').replace(/^\/+/, '')}`;
app.locals.routePath = (route = '') => {
  const normalizedRoute = String(route || '').startsWith('/') ? route : `/${route}`;
  return `${BASE_PATH}${normalizedRoute === '/' ? '' : normalizedRoute}`;
};
app.locals.formatLabel = (value) => value ? value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ') : '';
app.locals.formatCurrency = (value) => (value === null || value === undefined || value === '') ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
app.locals.statusBadgeClass = (status) => `status-${status || 'new'}`;

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.authError = req.session.authError || null;
  delete req.session.authError;
  next();
});

app.get('/', (req, res) => res.redirect(app.locals.routePath('/')));
app.get(`${BASE_PATH}`, (req, res) => {
  if (!req.session.user) return res.redirect(app.locals.routePath('/login'));
  return res.redirect(app.locals.routePath('/leads'));
});

app.get(`${BASE_PATH}/login`, (req, res) => {
  if (req.session.user) return res.redirect(app.locals.routePath('/leads'));
  res.render('login', { pageTitle: 'Login', defaultPasswordHint: store.DEFAULT_PASSWORD });
});

app.post(`${BASE_PATH}/login`, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');

    const user = await userRepository.findActiveUserByEmail(email);

    if (!user) {
      return res.status(401).render('login', {
        title: 'Login | gdor_backoffice',
        hideSidebar: true,
        error: 'Invalid email or password',
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).render('login', {
        title: 'Login | gdor_backoffice',
        hideSidebar: true,
        error: 'Invalid email or password',
      });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
    };

    res.redirect(app.locals.routePath('/leads'));
  } catch (err) {
    console.error('Login error:', err);

    res.status(500).render('login', {
      title: 'Login | gdor_backoffice',
      hideSidebar: true,
      error: 'Something went wrong. Try again.',
    });
  }
});

app.post(`${BASE_PATH}/logout`, requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('gdor.sid');
    res.redirect(app.locals.routePath('/login'));
  });
});

app.get(`${BASE_PATH}/leads`, requireAuth, (req, res) => {
  const filters = {
    status: req.query.status || '',
    source: req.query.source || '',
    owner: req.query.owner || '',
    q: req.query.q || ''
  };

  res.render('index', {
    leads: store.getLeads(filters),
    stats: store.getStats(),
    filters,
    users: store.getUsers(),
    statusOptions: STATUS_OPTIONS,
    leadSourceOptions: LEAD_SOURCE_OPTIONS,
  });
});

app.get(`${BASE_PATH}/leads/new`, requireAuth, (req, res) => {
  res.render('lead-form', {
    pageTitle: 'Add Lead',
    formAction: app.locals.routePath('/leads'),
    lead: {},
    users: store.getUsers(),
    statusOptions: STATUS_OPTIONS,
    serviceTypeOptions: SERVICE_TYPE_OPTIONS,
    leadSourceOptions: LEAD_SOURCE_OPTIONS,
  });
});

app.post(`${BASE_PATH}/leads`, requireAuth, (req, res) => {
  store.createLead(sanitizeLeadPayload(req.body));
  res.redirect(app.locals.routePath('/leads'));
});

app.get(`${BASE_PATH}/leads/:id`, requireAuth, (req, res) => {
  const lead = store.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');

  res.render('lead-detail', {
    lead,
    notes: store.getLeadNotesByLeadId(req.params.id),
    users: store.getUsers(),
    statusOptions: STATUS_OPTIONS,
  });
});

app.get(`${BASE_PATH}/leads/:id/edit`, requireAuth, (req, res) => {
  const lead = store.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');

  res.render('lead-form', {
    pageTitle: 'Edit Lead',
    formAction: app.locals.routePath(`/leads/${lead.id}`),
    lead,
    users: store.getUsers(),
    statusOptions: STATUS_OPTIONS,
    serviceTypeOptions: SERVICE_TYPE_OPTIONS,
    leadSourceOptions: LEAD_SOURCE_OPTIONS,
  });
});

app.post(`${BASE_PATH}/leads/:id`, requireAuth, (req, res) => {
  const updated = store.updateLead(req.params.id, sanitizeLeadPayload(req.body));
  if (!updated) return res.status(404).send('Lead not found');
  res.redirect(app.locals.routePath(`/leads/${req.params.id}`));
});

app.post(`${BASE_PATH}/leads/:id/status`, requireAuth, (req, res) => {
  if (!STATUS_OPTIONS.includes(req.body.status)) return res.status(400).send('Invalid status');
  const lead = store.updateLead(req.params.id, { status: req.body.status });
  if (!lead) return res.status(404).send('Lead not found');
  res.redirect(app.locals.routePath(`/leads/${req.params.id}`));
});

app.post(`${BASE_PATH}/leads/:id/notes`, requireAuth, (req, res) => {
  const lead = store.getLeadById(req.params.id);
  if (!lead) return res.status(404).send('Lead not found');

  const noteText = String(req.body.note_text || '').trim();
  if (noteText) {
    store.createLeadNote(req.params.id, noteText, req.session.user?.id || null);
  }

  res.redirect(app.locals.routePath(`/leads/${req.params.id}`));
});

app.post(`${BASE_PATH}/leads/:id/delete`, requireAuth, (req, res) => {
  store.deleteLead(req.params.id);
  res.redirect(app.locals.routePath('/leads'));
});

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  return res.redirect(app.locals.routePath('/login'));
}

function normalizeBasePath(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function sanitizeLeadPayload(body) {
  return {
    customer_name: requiredString(body.customer_name),
    phone: requiredString(body.phone),
    email: optionalString(body.email),
    address_line_1: optionalString(body.address_line_1),
    city: optionalString(body.city),
    state: optionalString(body.state),
    zip_code: optionalString(body.zip_code),
    service_type: SERVICE_TYPE_OPTIONS.includes(body.service_type) ? body.service_type : 'unknown',
    lead_source: LEAD_SOURCE_OPTIONS.includes(body.lead_source) ? body.lead_source : 'other',
    status: STATUS_OPTIONS.includes(body.status) ? body.status : 'new',
    assigned_user_id: toNullableInt(body.assigned_user_id),
    quoted_price: toNullableFloat(body.quoted_price),
    follow_up_date: optionalString(body.follow_up_date),
    next_action: optionalString(body.next_action),
    description: optionalString(body.description),
  };
}

function requiredString(value) { return String(value || '').trim(); }
function optionalString(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}
function toNullableInt(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}
function toNullableFloat(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

app.listen(PORT, () => {
  console.log(`gdor_backoffice listening on http://localhost:${PORT}${BASE_PATH}`);
});


const pool = require('./db/pool');

pool.query('SELECT NOW()')
  .then((res) => console.log('Postgres connected:', res.rows[0]))
  .catch((err) => console.error('Postgres connection failed', err));