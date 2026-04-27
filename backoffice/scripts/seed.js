const store = require('../store');

store.ensureStore();
const current = store.readStore();
if (current.leads.length > 0) {
  console.log('Leads already exist. Seed skipped.');
  process.exit(0);
}

const users = current.users;
const userIdByName = Object.fromEntries(users.map((u) => [u.name, u.id]));

[
  {
    customer_name: 'John Carter',
    phone: '555-111-2222',
    email: 'john@example.com',
    city: 'Roswell',
    state: 'GA',
    zip_code: '30075',
    service_type: 'opener_install',
    lead_source: 'facebook',
    status: 'new',
    assigned_user_id: userIdByName.Jay,
    quoted_price: 180,
    follow_up_date: '2026-04-22',
    next_action: 'Call and confirm opener model',
    description: 'Customer bought Chamberlain opener and wants install this weekend.'
  },
  {
    customer_name: 'Melissa Grant',
    phone: '555-222-3333',
    email: 'melissa@example.com',
    city: 'Alpharetta',
    state: 'GA',
    zip_code: '30004',
    service_type: 'garage_door_repair',
    lead_source: 'google_business',
    status: 'contacted',
    assigned_user_id: userIdByName.Zundra,
    quoted_price: 125,
    follow_up_date: '2026-04-21',
    next_action: 'Send quote by text',
    description: 'Door reverses halfway down. Wants same-day visit if possible.'
  },
  {
    customer_name: 'Daniel Brooks',
    phone: '555-444-5555',
    email: '',
    city: 'Sandy Springs',
    state: 'GA',
    zip_code: '30328',
    service_type: 'keypad_remote_programming',
    lead_source: 'referral',
    status: 'scheduled',
    assigned_user_id: userIdByName.Deji,
    quoted_price: 60,
    follow_up_date: '2026-04-23',
    next_action: 'Visit Tuesday at 6pm',
    description: 'Needs new keypad paired and two remotes programmed.'
  }
].forEach((lead) => store.createLead(lead));

console.log('Seeded demo leads.');
