(function () {
  const intakeEndpoint = "/backoffice/api/public/leads";

  const setStatus = (form, type, message) => {
    const status = form.querySelector("[data-lead-status]");
    if (!status) return;

    status.textContent = message;
    status.classList.remove(
      "hidden",
      "bg-green-50",
      "text-green-800",
      "bg-red-50",
      "text-red-800",
      "bg-neutral-100",
      "text-neutral-700"
    );

    if (type === "success") {
      status.classList.add("bg-green-50", "text-green-800");
    } else if (type === "error") {
      status.classList.add("bg-red-50", "text-red-800");
    } else {
      status.classList.add("bg-neutral-100", "text-neutral-700");
    }
  };

  const normalizeZip = (input) => {
    if (!input) return;
    input.value = input.value.replace(/\D/g, "").slice(0, 5);
  };

  const normalizePhone = (input) => {
    if (!input) return;
    input.value = input.value.replace(/[^0-9()+.\-\s]/g, "").slice(0, 20);
  };

  const toggleOtherSource = (form) => {
    const source = form.querySelector('[name="source"]');
    const other = form.querySelector('[name="source_other"]');
    if (!source || !other) return;

    const selected = source.value;
    if (selected === "Other" || selected === "Friend / Referral") {
      other.style.display = "block";
    } else {
      other.style.display = "none";
      other.value = "";
    }
  };

  const getHearAboutUs = (form, values) => {
    const source = String(values.source || "").trim();
    const sourceOther = String(values.source_other || "").trim();
    const explicit = String(values.hear_about_us || values.lead_source || "").trim();
    const formSource = form.dataset.leadSource || "Website form";

    if (source && sourceOther) return `${source}: ${sourceOther}`;
    if (source) return source;
    if (explicit) return explicit;
    return formSource;
  };

  const buildPayload = (form) => {
    const values = Object.fromEntries(new FormData(form).entries());

    return {
      name: values.name,
      phone: values.phone,
      email: values.email,
      preferred_contact_method: values.preferred_contact || values.preferred_contact_method,
      address: values.address,
      city: values.city,
      state: values.state || "GA",
      zip: values.zip,
      service_type: values.service_type,
      message: values.message,
      hear_about_us: getHearAboutUs(form, values),
      company_website: values.company_website
    };
  };

  const setSubmitting = (form, isSubmitting) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;

    if (!button.dataset.defaultText) {
      button.dataset.defaultText = button.textContent.trim();
    }

    button.disabled = isSubmitting;
    button.textContent = isSubmitting ? "Sending..." : button.dataset.defaultText;
    button.classList.toggle("opacity-70", isSubmitting);
    button.classList.toggle("cursor-not-allowed", isSubmitting);
  };

  const handleSubmit = async (event) => {
    const form = event.currentTarget;
    event.preventDefault();

    setSubmitting(form, true);
    setStatus(form, "pending", "Sending your request...");

    try {
      const response = await fetch(intakeEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(form))
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Something went wrong. Please call or text us.");
      }

      form.reset();
      toggleOtherSource(form);
      form.querySelectorAll('[name="zip"]').forEach(normalizeZip);
      setStatus(form, "success", "Thanks! We received your request and will contact you shortly.");
    } catch (error) {
      setStatus(form, "error", error.message || "Something went wrong. Please call or text us.");
    } finally {
      setSubmitting(form, false);
    }
  };

  document.querySelectorAll("[data-lead-form]").forEach((form) => {
    const source = form.querySelector('[name="source"]');
    const zip = form.querySelector('[name="zip"]');
    const phone = form.querySelector('[name="phone"]');

    if (source) {
      source.addEventListener("change", () => toggleOtherSource(form));
      toggleOtherSource(form);
    }

    if (zip) {
      zip.addEventListener("input", () => normalizeZip(zip));
      zip.addEventListener("blur", () => normalizeZip(zip));
    }

    if (phone) {
      phone.addEventListener("input", () => normalizePhone(phone));
      phone.addEventListener("blur", () => normalizePhone(phone));
    }

    form.addEventListener("submit", handleSubmit);
  });
})();
