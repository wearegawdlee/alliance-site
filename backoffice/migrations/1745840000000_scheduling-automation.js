exports.up = (pgm) => {
  pgm.createTable('business_closures', {
    id: 'id',
    closure_date: { type: 'date', notNull: true },
    reason: { type: 'varchar(255)', notNull: true },
    closure_type: { type: 'varchar(80)', notNull: true, default: 'holiday' },
    service_line_id: { type: 'integer', references: 'service_lines', onDelete: 'cascade' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });
  pgm.addConstraint('business_closures', 'business_closures_unique_date_scope', 'UNIQUE(closure_date, service_line_id)');
  pgm.createIndex('business_closures', ['closure_date', 'service_line_id'], { ifNotExists: true });

  pgm.createTable('technician_daily_capacities', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'cascade' },
    service_line_id: { type: 'integer', references: 'service_lines', onDelete: 'cascade' },
    max_jobs_per_day: { type: 'integer', notNull: true, default: 8 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  }, { ifNotExists: true });
  pgm.addConstraint('technician_daily_capacities', 'technician_daily_capacities_unique_scope', 'UNIQUE(user_id, service_line_id)');
  pgm.createIndex('technician_daily_capacities', ['user_id', 'service_line_id'], { ifNotExists: true });

  pgm.sql(`ALTER TABLE recurring_service_plan_runs ADD COLUMN IF NOT EXISTS due_for date`);
  pgm.sql(`ALTER TABLE recurring_service_plan_runs ADD COLUMN IF NOT EXISTS adjustment_reason text`);
  pgm.sql(`ALTER TABLE recurring_service_plan_runs ADD COLUMN IF NOT EXISTS generation_source varchar(80) NOT NULL DEFAULT 'manual'`);
  pgm.sql(`UPDATE recurring_service_plan_runs SET due_for = scheduled_for WHERE due_for IS NULL`);
  pgm.alterColumn('recurring_service_plan_runs', 'due_for', { notNull: true });
  pgm.sql(`ALTER TABLE recurring_service_plan_runs DROP CONSTRAINT IF EXISTS recurring_plan_run_unique`);
  pgm.addConstraint('recurring_service_plan_runs', 'recurring_plan_due_unique', 'UNIQUE(recurring_service_plan_id, due_for)');
  pgm.createIndex('recurring_service_plan_runs', ['scheduled_for'], { ifNotExists: true });

  pgm.sql(`
    INSERT INTO technician_daily_capacities(user_id, service_line_id, max_jobs_per_day)
    SELECT DISTINCT u.id, usl.service_line_id, 8
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.code = 'technician'
    JOIN user_service_lines usl ON usl.user_id = u.id
    WHERE u.is_active = true
    ON CONFLICT(user_id, service_line_id) DO NOTHING
  `);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE recurring_service_plan_runs DROP CONSTRAINT IF EXISTS recurring_plan_due_unique`);
  pgm.dropColumns('recurring_service_plan_runs', ['due_for', 'adjustment_reason', 'generation_source'], { ifExists: true });
  pgm.dropTable('technician_daily_capacities', { ifExists: true, cascade: true });
  pgm.dropTable('business_closures', { ifExists: true, cascade: true });
};
