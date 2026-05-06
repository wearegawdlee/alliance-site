exports.up = (pgm) => {
  pgm.sql(`
    INSERT INTO invoice_statuses(code,name,sort_order,is_terminal)
    VALUES ('payment_pending','Payment Pending',25,false),('payment_failed','Payment Failed',26,false)
    ON CONFLICT (code) DO NOTHING;
  `);

  pgm.createTable('payment_providers', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(150)', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });
  pgm.sql(`INSERT INTO payment_providers(code,name) VALUES ('stripe','Stripe') ON CONFLICT (code) DO NOTHING`);

  pgm.createTable('customer_payment_profiles', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    payment_provider_id: { type: 'integer', notNull: true, references: 'payment_providers', onDelete: 'restrict' },
    provider_customer_id: { type: 'varchar(255)', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });
  pgm.addConstraint('customer_payment_profiles','customer_payment_profiles_unique_provider_customer','UNIQUE(payment_provider_id, provider_customer_id)');
  pgm.addConstraint('customer_payment_profiles','customer_payment_profiles_unique_customer_provider','UNIQUE(customer_id, payment_provider_id)');
  pgm.createIndex('customer_payment_profiles','customer_id');

  pgm.createTable('customer_payment_methods', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    payment_provider_id: { type: 'integer', notNull: true, references: 'payment_providers', onDelete: 'restrict' },
    provider_payment_method_id: { type: 'varchar(255)', notNull: true },
    payment_type: { type: 'varchar(40)', notNull: true },
    brand: { type: 'varchar(80)' },
    last4: { type: 'varchar(12)' },
    bank_name: { type: 'varchar(150)' },
    expiration_month: { type: 'integer' },
    expiration_year: { type: 'integer' },
    is_default: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });
  pgm.addConstraint('customer_payment_methods','customer_payment_methods_unique_provider_method','UNIQUE(payment_provider_id, provider_payment_method_id)');
  pgm.createIndex('customer_payment_methods','customer_id');

  pgm.createTable('customer_autopay_settings', {
    customer_id: { type: 'integer', primaryKey: true, references: 'customers', onDelete: 'cascade' },
    is_enabled: { type: 'boolean', notNull: true, default: false },
    payment_method_id: { type: 'integer', references: 'customer_payment_methods', onDelete: 'set null' },
    max_charge_amount: { type: 'numeric(10,2)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });

  pgm.createTable('payment_attempts', {
    id: 'id',
    invoice_id: { type: 'integer', notNull: true, references: 'invoices', onDelete: 'cascade' },
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    payment_provider_id: { type: 'integer', notNull: true, references: 'payment_providers', onDelete: 'restrict' },
    customer_payment_method_id: { type: 'integer', references: 'customer_payment_methods', onDelete: 'set null' },
    payment_type: { type: 'varchar(40)', notNull: true },
    status: { type: 'varchar(60)', notNull: true },
    amount: { type: 'numeric(10,2)', notNull: true },
    provider_payment_intent_id: { type: 'varchar(255)' },
    provider_checkout_session_id: { type: 'varchar(255)' },
    failure_message: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });
  pgm.createIndex('payment_attempts','invoice_id');
  pgm.createIndex('payment_attempts','customer_id');
  pgm.createIndex('payment_attempts','provider_payment_intent_id');
  pgm.createIndex('payment_attempts','provider_checkout_session_id');

  pgm.createTable('payment_events', {
    id: 'id',
    payment_provider_id: { type: 'integer', notNull: true, references: 'payment_providers', onDelete: 'restrict' },
    provider_event_id: { type: 'varchar(255)', notNull: true, unique: true },
    event_type: { type: 'varchar(120)', notNull: true },
    payload: { type: 'jsonb', notNull: true },
    processed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });

  pgm.sql(`INSERT INTO payment_methods(code,name) VALUES ('stripe_card','Stripe Card'),('stripe_ach','Stripe ACH') ON CONFLICT (code) DO NOTHING`);
};

exports.down = (pgm) => {
  ['payment_events','payment_attempts','customer_autopay_settings','customer_payment_methods','customer_payment_profiles','payment_providers'].forEach((table)=>pgm.dropTable(table,{ ifExists: true, cascade: true }));
  pgm.sql(`DELETE FROM invoice_statuses WHERE code IN ('payment_pending','payment_failed')`);
  pgm.sql(`DELETE FROM payment_methods WHERE code IN ('stripe_card','stripe_ach')`);
};
