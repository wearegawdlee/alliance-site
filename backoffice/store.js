const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'store.json');
const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD || 'ChangeMe123!';

function ensureStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    const initial = {
      counters: { leads: 0, leadNotes: 0, users: 0 },
      users: [],
      leads: [],
      leadNotes: []
    };
    fs.writeFileSync(dataFile, JSON.stringify(initial, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeStore(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function seedUsers() {
  const store = readStore();
  if (store.users.length > 0) {
    let changed = false;
    store.users = store.users.map((user) => {
      const next = { ...user };
      if (!next.email) {
        next.email = `${String(user.name || '').toLowerCase()}@local.gdor`;
        changed = true;
      }
      if (!next.password_hash) {
        next.password_hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);
        changed = true;
      }
      if (typeof next.is_active !== 'boolean') {
        next.is_active = true;
        changed = true;
      }
      if (!next.updated_at) {
        next.updated_at = next.created_at || new Date().toISOString();
        changed = true;
      }
      return next;
    });

    if (changed) writeStore(store);
    return;
  }

  const users = [
    { name: 'Jay', role: 'owner', email: 'jay@local.gdor' },
    { name: 'Zundra', role: 'admin', email: 'zundra@local.gdor' },
    { name: 'Adriana', role: 'bookkeeping', email: 'adriana@local.gdor' },
    { name: 'Denise', role: 'marketing', email: 'denise@local.gdor' },
    { name: 'Deji', role: 'apprentice', email: 'deji@local.gdor' }
  ];

  users.forEach((user) => {
    store.counters.users += 1;
    const now = new Date().toISOString();
    store.users.push({
      id: store.counters.users,
      created_at: now,
      updated_at: now,
      is_active: true,
      password_hash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      ...user
    });
  });

  writeStore(store);
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

function getUsers() {
  const store = readStore();
  return [...store.users].map(sanitizeUser).sort((a, b) => a.name.localeCompare(b.name));
}

function getUserById(id) {
  const store = readStore();
  return sanitizeUser(store.users.find((u) => u.id === Number(id)) || null);
}

function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const store = readStore();
  return store.users.find((u) => String(u.email || '').trim().toLowerCase() === normalized) || null;
}

function authenticateUser(email, password) {
  const user = getUserByEmail(email);
  if (!user || !user.is_active) return null;
  if (!bcrypt.compareSync(String(password || ''), user.password_hash || '')) return null;
  return sanitizeUser(user);
}

function getLeads(filters = {}) {
  const store = readStore();
  let leads = store.leads.map((lead) => ({
    ...lead,
    assigned_user_name: store.users.find((u) => u.id === lead.assigned_user_id)?.name || null
  }));

  if (filters.status) leads = leads.filter((l) => l.status === filters.status);
  if (filters.source) leads = leads.filter((l) => l.lead_source === filters.source);
  if (filters.owner) leads = leads.filter((l) => l.assigned_user_name === filters.owner);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    leads = leads.filter((lead) =>
      [
        lead.customer_name,
        lead.phone,
        lead.email,
        lead.city,
        lead.zip_code,
        lead.next_action,
        lead.description
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }

  return leads.sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
}

function getLeadById(id) {
  const store = readStore();
  const lead = store.leads.find((l) => l.id === Number(id));
  if (!lead) return null;

  return {
    ...lead,
    assigned_user_name: store.users.find((u) => u.id === lead.assigned_user_id)?.name || null
  };
}

function createLead(payload) {
  const store = readStore();
  store.counters.leads += 1;
  const now = new Date().toISOString();
  const lead = {
    id: store.counters.leads,
    created_at: now,
    updated_at: now,
    ...payload
  };
  store.leads.push(lead);
  writeStore(store);
  return lead;
}

function updateLead(id, payload) {
  const store = readStore();
  const index = store.leads.findIndex((l) => l.id === Number(id));
  if (index === -1) return null;

  const existing = store.leads[index];
  store.leads[index] = {
    ...existing,
    ...payload,
    id: existing.id,
    created_at: existing.created_at,
    updated_at: new Date().toISOString()
  };

  writeStore(store);
  return store.leads[index];
}

function deleteLead(id) {
  const store = readStore();
  store.leads = store.leads.filter((l) => l.id !== Number(id));
  store.leadNotes = store.leadNotes.filter((n) => n.lead_id !== Number(id));
  writeStore(store);
}

function createLeadNote(leadId, noteText, createdByUserId = null) {
  const store = readStore();
  store.counters.leadNotes += 1;
  const note = {
    id: store.counters.leadNotes,
    lead_id: Number(leadId),
    note_text: noteText,
    created_by_user_id: createdByUserId ? Number(createdByUserId) : null,
    created_at: new Date().toISOString()
  };
  store.leadNotes.push(note);
  writeStore(store);
  return note;
}

function getLeadNotesByLeadId(leadId) {
  const store = readStore();
  return store.leadNotes
    .filter((n) => n.lead_id === Number(leadId))
    .map((note) => ({
      ...note,
      created_by_name: store.users.find((u) => u.id === note.created_by_user_id)?.name || null
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id);
}

function getStats() {
  const store = readStore();
  const openStatuses = new Set(['new', 'contacted', 'waiting', 'scheduled']);
  const today = new Date().toISOString().slice(0, 10);

  return {
    total: store.leads.length,
    open: store.leads.filter((l) => openStatuses.has(l.status)).length,
    dueFollowUps: store.leads.filter((l) => l.follow_up_date && l.follow_up_date <= today && openStatuses.has(l.status)).length,
    completedOrPaid: store.leads.filter((l) => ['completed', 'paid'].includes(l.status)).length
  };
}

seedUsers();

module.exports = {
  DEFAULT_PASSWORD,
  getUsers,
  getUserById,
  getUserByEmail,
  authenticateUser,
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  createLeadNote,
  getLeadNotesByLeadId,
  getStats,
  ensureStore,
  readStore,
  writeStore
};
