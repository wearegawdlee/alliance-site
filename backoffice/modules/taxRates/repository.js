const pool = require('../../db/pool');

function like(value){
  const q = String(value || '').trim();
  return q ? `%${q}%` : null;
}

async function listTaxRates(filters = {}){
  const params = [];
  const where = [];
  const search = like(filters.search);

  if(search){
    params.push(search);
    where.push(`(state ILIKE $${params.length} OR county ILIKE $${params.length} OR city ILIKE $${params.length} OR postal_code ILIKE $${params.length})`);
  }

  if(filters.active === 'active') where.push('is_active=true');
  if(filters.active === 'inactive') where.push('is_active=false');

  const result = await pool.query(`
    SELECT *
    FROM tax_rates
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY is_active DESC, state, county, city NULLS FIRST, postal_code NULLS FIRST, effective_start_date DESC
  `, params);

  return result.rows;
}

async function getTaxRate(id){
  const result = await pool.query('SELECT * FROM tax_rates WHERE id=$1', [id]);
  return result.rows[0] || null;
}

async function createTaxRate(data){
  const result = await pool.query(`
    INSERT INTO tax_rates(state, county, city, postal_code, rate, effective_start_date, effective_end_date, is_active)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING id
  `, [data.state, data.county, data.city, data.postal_code, data.rate, data.effective_start_date, data.effective_end_date, data.is_active]);

  return result.rows[0].id;
}

async function updateTaxRate(id, data){
  await pool.query(`
    UPDATE tax_rates
    SET state=$1,
        county=$2,
        city=$3,
        postal_code=$4,
        rate=$5,
        effective_start_date=$6,
        effective_end_date=$7,
        is_active=$8,
        updated_at=current_timestamp
    WHERE id=$9
  `, [data.state, data.county, data.city, data.postal_code, data.rate, data.effective_start_date, data.effective_end_date, data.is_active, id]);
}

async function deleteTaxRate(id){
  const refs = await pool.query('SELECT COUNT(*)::int AS invoice_count FROM invoices WHERE tax_rate_id=$1', [id]);

  if(refs.rows[0].invoice_count > 0){
    await pool.query('UPDATE tax_rates SET is_active=false, updated_at=current_timestamp WHERE id=$1', [id]);
    return { archived: true };
  }

  await pool.query('DELETE FROM tax_rates WHERE id=$1', [id]);
  return { deleted: true };
}

module.exports = { listTaxRates, getTaxRate, createTaxRate, updateTaxRate, deleteTaxRate };
