# Public Lead Intake API

The public website should post lead form submissions to the backoffice API instead of Formspree.

Endpoint:

```text
POST /backoffice/api/public/leads
Content-Type: application/json
```

The endpoint is intentionally under `/backoffice` so the existing Nginx proxy path can handle it without adding a new `/api` proxy rule.

## Accepted fields

```json
{
  "name": "Jane Smith",
  "phone": "404-555-1212",
  "email": "jane@example.com",
  "preferred_contact_method": "Phone",
  "address": "123 Main St",
  "city": "Roswell",
  "state": "GA",
  "zip": "30075",
  "service_type": "Broken spring",
  "message": "Door will not open",
  "hear_about_us": "Google"
}
```

Aliases are accepted for a few fields, including `serviceType`, `postal_code`, `zip_code`, `hearAboutUs`, and `lead_source`.

## What it creates

A submission creates:

- `customers` row with status `Prospect`
- primary `customer_contacts` row
- primary `customer_locations` row
- `customer_service_lines` row inferred from the selected service type
- `customer_notes` row containing the intake details
- `customer_status_history` row
- `activity_events` row with `website_lead.received`

## Recommended Astro submit handler

```html
<form id="lead-form">
  <input
    type="text"
    name="company_website"
    tabindex="-1"
    autocomplete="off"
    style="display:none"
  />
  <!-- existing fields -->
</form>

<script>
  const form = document.querySelector("#lead-form");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = Object.fromEntries(new FormData(form).entries());

    const response = await fetch("/backoffice/api/public/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      alert(result.error || "Something went wrong. Please call or text us.");
      return;
    }

    form.reset();
    alert("Thanks! We received your request and will contact you shortly.");
  });
</script>
```

## Notification hook

The first notification trigger should listen for `activity_events.event_type = 'website_lead.received'`.

That keeps notification delivery separate from lead persistence, so email/SMS/Slack-style alerts can be added without coupling them to the customer-create transaction.
