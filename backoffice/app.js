require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const appConfig = require('./config/app-config');
const userRepository = require('./db/user-repository');
const customerRoutes = require('./modules/customers/routes');
const workOrderRoutes = require('./modules/workOrders/routes');
const billingRoutes = require('./modules/billing/routes');
const catalogRoutes = require('./modules/catalog/routes');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_PATH = normalizeBasePath(process.env.BASE_PATH || '/backoffice');
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace-me-in-production';
const USE_SECURE_COOKIE = process.env.USE_SECURE_COOKIE === 'true';

app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'));
app.set('trust proxy',1);
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(session({name:'gdor.sid',secret:SESSION_SECRET,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:USE_SECURE_COOKIE,maxAge:1000*60*60*12}}));
app.use(`${BASE_PATH}/assets`, express.static(path.join(__dirname,'public')));

app.locals.appConfig = appConfig;
app.locals.basePath = BASE_PATH;
app.locals.assetPath = asset => `${BASE_PATH}/assets/${String(asset||'').replace(/^\/+/, '')}`;
app.locals.routePath = (route='') => { const r=String(route||'').startsWith('/')?route:`/${route}`; return `${BASE_PATH}${r==='/'?'':r}`; };
app.locals.formatCurrency = value => (value===null||value===undefined||value==='')?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
app.locals.formatDate = value => value ? new Date(value).toLocaleDateString() : '—';

app.use((req,res,next)=>{res.locals.currentUser=req.session.user||null; next();});
app.get('/',(req,res)=>res.redirect(app.locals.routePath('/')));
app.get(`${BASE_PATH}`,(req,res)=> req.session.user ? res.redirect(app.locals.routePath('/customers')) : res.redirect(app.locals.routePath('/login')));
app.get(`${BASE_PATH}/login`,(req,res)=>{ if(req.session.user) return res.redirect(app.locals.routePath('/customers')); res.render('login',{title:'Login',hideSidebar:true,error:null}); });
app.post(`${BASE_PATH}/login`, async (req,res)=>{try{const email=String(req.body.email||'').trim();const password=String(req.body.password||'');const user=await userRepository.findActiveUserByEmail(email);if(!user) return renderLoginError(res);const ok=await bcrypt.compare(password,user.password_hash);if(!ok) return renderLoginError(res);req.session.user={id:user.id,email:user.email,displayName:user.display_name,role:user.role};req.session.save(err=>{if(err){console.error(err);return renderLoginError(res,'Could not save session. Try again.')}res.redirect(app.locals.routePath('/customers'));});}catch(e){console.error(e);renderLoginError(res,'Something went wrong. Try again.')}});
app.post(`${BASE_PATH}/logout`, requireAuth, (req,res)=>{req.session.destroy(()=>{res.clearCookie('gdor.sid');res.redirect(app.locals.routePath('/login'));});});
app.get(`${BASE_PATH}/health`,(req,res)=>res.json({ok:true}));
app.get(`${BASE_PATH}/leads`, requireAuth, (req,res)=>res.redirect(app.locals.routePath('/customers')));
app.use(app.locals.routePath('/customers'), requireAuth, customerRoutes);
app.use(app.locals.routePath('/work-orders'), requireAuth, workOrderRoutes);
app.use(app.locals.routePath('/billing'), requireAuth, billingRoutes);
app.use(app.locals.routePath('/catalog'), requireAuth, catalogRoutes);
app.use((err,req,res,next)=>{console.error(err);res.status(500).send('Server error');});

function requireAuth(req,res,next){ if(req.session.user) return next(); res.redirect(app.locals.routePath('/login')); }
function renderLoginError(res,error='Invalid email or password'){ return res.status(401).render('login',{title:'Login',hideSidebar:true,error}); }
function normalizeBasePath(value){const t=String(value||'').trim(); if(!t||t==='/') return ''; return (t.startsWith('/')?t:`/${t}`).replace(/\/+$/,'');}
app.listen(PORT,()=>console.log(`${appConfig.brand.backofficeName} listening on http://localhost:${PORT}${BASE_PATH}`));
