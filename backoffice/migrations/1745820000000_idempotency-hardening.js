exports.up = (pgm) => {
  pgm.sql(`
    -- Defensive indexes for payment/provider retry safety.
    -- These are intentionally partial so normal NULL values can repeat.
    CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_unique_checkout_session
      ON payment_attempts(provider_checkout_session_id)
      WHERE provider_checkout_session_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_unique_payment_intent
      ON payment_attempts(provider_payment_intent_id)
      WHERE provider_payment_intent_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS payments_unique_stripe_reference
      ON payments(reference_number)
      WHERE reference_number IS NOT NULL
        AND notes = 'Online payment via Stripe';

    CREATE INDEX IF NOT EXISTS payment_attempts_invoice_status_idx
      ON payment_attempts(invoice_id, status);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS payment_attempts_invoice_status_idx;
    DROP INDEX IF EXISTS payments_unique_stripe_reference;
    DROP INDEX IF EXISTS payment_attempts_unique_payment_intent;
    DROP INDEX IF EXISTS payment_attempts_unique_checkout_session;
  `);
};
