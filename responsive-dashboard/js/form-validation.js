/* ==========================================================
   Accessible form validation
   - Uses the browser's built-in rules (required, pattern, min, max, type...).
   - Shows each error next to its field and links it with aria-describedby.
   - Shows an error summary at the top with links to each problem field.
   - Works for normal forms and forms inside <dialog method="dialog">.
   Markup contract for each field (or the first radio in a group):
     data-error="Message to show"   data-error-target="id-of-error-element"
   ========================================================== */
function fieldsToCheck(form) {
  const seenGroups = new Set();
  return Array.from(form.elements).filter((el) => {
    if (!el.dataset || !el.dataset.errorTarget) return false;
    if (el.type === "radio" || (el.type === "checkbox" && el.name && form.querySelectorAll(`[name="${el.name}"]`).length > 1)) {
      if (seenGroups.has(el.name)) return false;
      seenGroups.add(el.name);
    }
    return true;
  });
}

function groupIsInvalid(form, el) {
  if (el.type === "radio") {
    const group = form.querySelectorAll(`input[name="${el.name}"]`);
    return el.required && !Array.from(group).some((r) => r.checked);
  }
  return !el.checkValidity();
}

function setError(form, el, message) {
  const errorEl = document.getElementById(el.dataset.errorTarget);
  if (errorEl) errorEl.textContent = message ? `Error: ${message}` : "";
  const fieldset = el.closest("fieldset[data-group]");
  if (el.type === "radio" && fieldset) {
    fieldset.classList.toggle("has-error", Boolean(message));
    form.querySelectorAll(`input[name="${el.name}"]`).forEach((r) => {
      if (message) r.setAttribute("aria-invalid", "true"); else r.removeAttribute("aria-invalid");
    });
  } else if (message) {
    el.setAttribute("aria-invalid", "true");
  } else {
    el.removeAttribute("aria-invalid");
  }
}

function validate(form) {
  const problems = [];
  for (const el of fieldsToCheck(form)) {
    if (groupIsInvalid(form, el)) {
      const message = el.dataset.error || el.validationMessage;
      setError(form, el, message);
      problems.push({ el, message });
    } else {
      setError(form, el, "");
    }
  }
  return problems;
}

function renderSummary(form, problems) {
  const summary = form.querySelector(".error-summary");
  if (!summary) return;
  const list = summary.querySelector("ul");
  list.innerHTML = "";
  if (!problems.length) { summary.hidden = true; return; }

  for (const { el, message } of problems) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${el.id}`;
    link.textContent = message;
    link.addEventListener("click", (event) => { event.preventDefault(); el.focus(); });
    li.append(link);
    list.append(li);
  }
  summary.hidden = false;
  summary.focus();
}

document.querySelectorAll("form[data-validate]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    const problems = validate(form);
    renderSummary(form, problems);

    if (problems.length) {
      event.preventDefault();               // stays open / stays on page
      return;
    }

    const status = document.getElementById(form.dataset.statusTarget || "page-status");
    if (form.method === "dialog") {
      // Let the dialog close, then announce the result on the page
      const vehicle = form.querySelector("[data-vehicle-field]")?.value || "";
      if (status) status.textContent = (form.dataset.successMessage || "Saved.").replace("{vehicle}", vehicle);
      setTimeout(() => form.reset(), 0);
    } else {
      // No back end in this skeleton: show success instead of sending
      event.preventDefault();
      if (status) status.textContent = form.dataset.successMessage || "Saved.";
      form.reset();
    }
  });

  // Clear a field's error as soon as the user fixes it
  form.addEventListener("change", (event) => {
    const el = event.target.type === "radio"
      ? form.querySelector(`input[name="${event.target.name}"][data-error-target]`)
      : event.target;
    if (el?.dataset?.errorTarget && el.getAttribute("aria-invalid") === "true" && !groupIsInvalid(form, el)) {
      setError(form, el, "");
    }
  });

  form.addEventListener("reset", () => {
    fieldsToCheck(form).forEach((el) => setError(form, el, ""));
    renderSummary(form, []);
  });
});
