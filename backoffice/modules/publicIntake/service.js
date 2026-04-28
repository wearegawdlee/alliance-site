const repository = require('./repository');
const notifications = require('../notifications/service');

function clean(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeLeadPayload(body, req) {
  return {
    name: clean(body.name || body.full_name || body.display_name),
    phone: clean(body.phone),
    email: clean(body.email),
    preferred_contact_method: clean(body.preferred_contact_method || body.preferredContactMethod),
    address_line_1: clean(body.address || body.address_line_1 || body.addressLine1),
    city: clean(body.city),
    state: clean(body.state) || 'GA',
    postal_code: clean(body.zip || body.zip_code || body.postal_code || body.postalCode),
    service_type: clean(body.service_type || body.serviceType),
    message: clean(body.message || body.description || body.problem),
    hear_about_us: clean(body.hear_about_us || body.hearAboutUs || body.lead_source || body.leadSource),
    source_ip: req.ip,
    user_agent: req.get('user-agent') || null
  };
}

function validateLead(data) {
  const errors = [];

  if (!data.name) errors.push('Name is required.');
  if (!data.phone && !data.email) errors.push('Phone or email is required.');
  if (!data.service_type) errors.push('Service type is required.');

  return errors;
}

async function createWebsiteLead(body, req) {
  // Honeypot support. Add a hidden input named company_website on the public form.
  // Real users will leave it blank; bots often fill it. We return success without creating anything.
  if (String(body.company_website || body.website || '').trim()) {
    return { ignored: true };
  }

  const data = normalizeLeadPayload(body, req);
  const errors = validateLead(data);

  if (errors.length) {
    const err = new Error(errors.join(' '));
    err.status = 400;
    throw err;
  }

  const result = await repository.createWebsiteLead(data);
  notifications.notifyWebsiteLead({ customerId: result.customerId, lead: data });
  return result;
}

module.exports = { createWebsiteLead };
