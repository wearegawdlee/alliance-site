const repo = require('./repository');

function clean(value){
  const s = String(value || '').trim();
  return s || null;
}

function parseRate(value){
  if(value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if(Number.isNaN(n) || n < 0) throw new Error('Tax rate must be a positive number');
  return Number((n / 100).toFixed(5));
}

function presentRate(rate){
  return Number((Number(rate || 0) * 100).toFixed(3));
}

function payload(body){
  return {
    state: (clean(body.state) || 'GA').toUpperCase().slice(0, 2),
    county: clean(body.county),
    city: clean(body.city),
    postal_code: clean(body.postal_code),
    rate: parseRate(body.rate_percent),
    effective_start_date: clean(body.effective_start_date) || new Date().toISOString().slice(0, 10),
    effective_end_date: clean(body.effective_end_date),
    is_active: body.is_active === '1' || body.is_active === 'true' || body.is_active === 'on'
  };
}

async function listTaxRates(query){
  const rows = await repo.listTaxRates(query || {});
  return rows.map(row => ({ ...row, rate_percent: presentRate(row.rate) }));
}

async function getTaxRate(id){
  const row = await repo.getTaxRate(id);
  return row ? { ...row, rate_percent: presentRate(row.rate) } : null;
}

async function createTaxRate(body){
  const data = payload(body);
  if(!data.county) throw new Error('County is required');
  return repo.createTaxRate(data);
}

async function updateTaxRate(id, body){
  const data = payload(body);
  if(!data.county) throw new Error('County is required');
  return repo.updateTaxRate(id, data);
}

async function deleteTaxRate(id){
  return repo.deleteTaxRate(id);
}

module.exports = { listTaxRates, getTaxRate, createTaxRate, updateTaxRate, deleteTaxRate };
