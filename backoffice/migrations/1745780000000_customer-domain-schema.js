/* eslint-disable camelcase */

exports.up = (pgm) => {
  // Preserve users/auth, rebuild business-domain tables around Customers.
  const domainTables = [
    'payments',
    'invoice_line_items',
    'invoices',
    'inventory_items',
    'work_orders',
    'customer_notes',
    'customer_service_lines',
    'customer_addresses',
    'customer_contacts',
    'customers',
    'client_notes',
    'client_service_lines',
    'client_addresses',
    'client_contacts',
    'clients',
    'lead_status_history',
    'lead_notes',
    'leads',
    'service_types',
    'lead_statuses',
    'addresses',
    'contacts',
    'payment_methods',
    'invoice_statuses',
    'work_order_statuses',
    'service_lines',
    'lead_sources',
    'customer_statuses',
    'client_statuses'
  ];

  domainTables.forEach((table) => pgm.dropTable(table, { ifExists: true, cascade: true }));

  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    display_name: { type: 'varchar(150)', notNull: true },
    role: { type: 'varchar(50)', notNull: true, default: 'user' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });

  pgm.createTable('customer_statuses', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    sort_order: { type: 'integer', notNull: true },
    is_terminal: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true }
  });

  pgm.createTable('lead_sources', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true }
  });

  pgm.createTable('service_lines', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    description: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('work_order_statuses', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    sort_order: { type: 'integer', notNull: true },
    is_terminal: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true }
  });

  pgm.createTable('invoice_statuses', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    sort_order: { type: 'integer', notNull: true },
    is_terminal: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true }
  });

  pgm.createTable('payment_methods', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true }
  });

  pgm.createTable('customers', {
    id: 'id',
    display_name: { type: 'varchar(255)', notNull: true },
    customer_status_id: { type: 'integer', notNull: true, references: 'customer_statuses', onDelete: 'restrict' },
    lead_source_id: { type: 'integer', references: 'lead_sources', onDelete: 'set null' },
    assigned_user_id: { type: 'integer', references: 'users', onDelete: 'set null' },
    company_name: { type: 'varchar(255)' },
    notes_summary: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('customer_contacts', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' },
    phone: { type: 'varchar(50)' },
    email: { type: 'varchar(255)' },
    preferred_contact_method: { type: 'varchar(50)' },
    is_primary: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('customer_addresses', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    label: { type: 'varchar(80)', notNull: true, default: 'Service Address' },
    address_line_1: { type: 'varchar(255)' },
    address_line_2: { type: 'varchar(255)' },
    city: { type: 'varchar(100)' },
    state: { type: 'varchar(50)' },
    postal_code: { type: 'varchar(20)' },
    is_primary: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('customer_service_lines', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    service_line_id: { type: 'integer', notNull: true, references: 'service_lines', onDelete: 'restrict' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.addConstraint('customer_service_lines', 'customer_service_lines_customer_service_unique', 'UNIQUE(customer_id, service_line_id)');

  pgm.createTable('customer_notes', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    author_user_id: { type: 'integer', references: 'users', onDelete: 'set null' },
    note_body: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('work_orders', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    service_line_id: { type: 'integer', notNull: true, references: 'service_lines', onDelete: 'restrict' },
    work_order_status_id: { type: 'integer', notNull: true, references: 'work_order_statuses', onDelete: 'restrict' },
    assigned_user_id: { type: 'integer', references: 'users', onDelete: 'set null' },
    title: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    scheduled_start_at: { type: 'timestamptz' },
    scheduled_end_at: { type: 'timestamptz' },
    quoted_price: { type: 'numeric(10,2)' },
    final_price: { type: 'numeric(10,2)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('inventory_items', {
    id: 'id',
    service_line_id: { type: 'integer', references: 'service_lines', onDelete: 'set null' },
    sku: { type: 'varchar(100)', unique: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    unit_price: { type: 'numeric(10,2)', notNull: true, default: 0 },
    cost: { type: 'numeric(10,2)' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('invoices', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'restrict' },
    work_order_id: { type: 'integer', references: 'work_orders', onDelete: 'set null' },
    invoice_status_id: { type: 'integer', notNull: true, references: 'invoice_statuses', onDelete: 'restrict' },
    invoice_number: { type: 'varchar(80)', unique: true },
    issue_date: { type: 'date' },
    due_date: { type: 'date' },
    subtotal: { type: 'numeric(10,2)', notNull: true, default: 0 },
    tax_amount: { type: 'numeric(10,2)', notNull: true, default: 0 },
    total_amount: { type: 'numeric(10,2)', notNull: true, default: 0 },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('invoice_line_items', {
    id: 'id',
    invoice_id: { type: 'integer', notNull: true, references: 'invoices', onDelete: 'cascade' },
    inventory_item_id: { type: 'integer', references: 'inventory_items', onDelete: 'set null' },
    description: { type: 'text', notNull: true },
    quantity: { type: 'numeric(10,2)', notNull: true, default: 1 },
    unit_price: { type: 'numeric(10,2)', notNull: true, default: 0 },
    line_total: { type: 'numeric(10,2)', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createTable('payments', {
    id: 'id',
    invoice_id: { type: 'integer', notNull: true, references: 'invoices', onDelete: 'cascade' },
    payment_method_id: { type: 'integer', references: 'payment_methods', onDelete: 'set null' },
    amount: { type: 'numeric(10,2)', notNull: true },
    received_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    reference_number: { type: 'varchar(255)' },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createIndex('customers', 'customer_status_id');
  pgm.createIndex('customers', 'lead_source_id');
  pgm.createIndex('customers', 'assigned_user_id');
  pgm.createIndex('customer_contacts', 'customer_id');
  pgm.createIndex('customer_contacts', 'phone');
  pgm.createIndex('customer_contacts', 'email');
  pgm.createIndex('customer_addresses', 'customer_id');
  pgm.createIndex('customer_service_lines', 'customer_id');
  pgm.createIndex('customer_service_lines', 'service_line_id');
  pgm.createIndex('customer_notes', 'customer_id');
  pgm.createIndex('work_orders', 'customer_id');
  pgm.createIndex('work_orders', 'service_line_id');
  pgm.createIndex('work_orders', 'work_order_status_id');
  pgm.createIndex('work_orders', 'scheduled_start_at');
  pgm.createIndex('inventory_items', 'service_line_id');
  pgm.createIndex('invoices', 'customer_id');
  pgm.createIndex('invoices', 'work_order_id');
  pgm.createIndex('invoices', 'invoice_status_id');
  pgm.createIndex('invoice_line_items', 'invoice_id');
  pgm.createIndex('payments', 'invoice_id');

  pgm.sql(`INSERT INTO customer_statuses(code,name,sort_order,is_terminal) VALUES ('prospect','Prospect',1,false),('qualified_lead','Qualified Lead',2,false),('customer','Customer',3,false),('inactive','Inactive',4,true),('lost','Lost',5,true)`);
  pgm.sql(`INSERT INTO lead_sources(code,name) VALUES ('website','Website'),('phone','Phone'),('google_business','Google Business'),('facebook','Facebook'),('thumbtack','Thumbtack'),('angi','Angi'),('referral','Referral'),('other','Other')`);
  pgm.sql(`INSERT INTO service_lines(code,name,description) VALUES ('garage_doors','Garage Doors','Garage door repair, installation, opener installation, and related services.'),('pools','Pools','Pool maintenance, repair, cleaning, and related services.'),('motorized_screens','Motorized Screens','Motorized screen installation, maintenance, and related services.')`);
  pgm.sql(`INSERT INTO work_order_statuses(code,name,sort_order,is_terminal) VALUES ('requested','Requested',1,false),('scheduled','Scheduled',2,false),('in_progress','In Progress',3,false),('completed','Completed',4,true),('cancelled','Cancelled',5,true)`);
  pgm.sql(`INSERT INTO invoice_statuses(code,name,sort_order,is_terminal) VALUES ('draft','Draft',1,false),('sent','Sent',2,false),('partially_paid','Partially Paid',3,false),('paid','Paid',4,true),('void','Void',5,true)`);
  pgm.sql(`INSERT INTO payment_methods(code,name) VALUES ('cash','Cash'),('check','Check'),('zelle','Zelle'),('venmo','Venmo'),('card','Card'),('other','Other')`);
};

exports.down = (pgm) => {
  [
    'payments',
    'invoice_line_items',
    'invoices',
    'inventory_items',
    'work_orders',
    'customer_notes',
    'customer_service_lines',
    'customer_addresses',
    'customer_contacts',
    'customers',
    'payment_methods',
    'invoice_statuses',
    'work_order_statuses',
    'service_lines',
    'lead_sources',
    'customer_statuses'
  ].forEach((table) => pgm.dropTable(table, { ifExists: true, cascade: true }));
};
