/**
 * forms.js
 * Accessible form validation, reused by every form in the app.
 *
 * Markup contract for each field:
 *   data-error="Message"            shown when the browser's checks fail (required, pattern, min...)
 *   aria-describedby="... <id>-error"  links the error text to the field
 *   <p id="<id>-error" class="error-message"></p>
 * Radio groups: put data-error on the first radio and data-error-target="<name>-error".
 *
 * On a failed submit: errors appear next to fields (prefixed "Error:"), fields get
 * aria-invalid="true", and an error summary at the top receives focus with links to each field.
 */

const errorIdFor = (field) => field.dataset.errorTarget || `${field.id}-error`;

function checkables(form) {
  const seen = new Set();
  return [...form.elements].filter((field) => {
    if (!field.dataset?.error) return false;
    if (field.type === "radio") {
      if (seen.has(field.name)) return false;
      seen.add(field.name);
    }
    return true;
  });
}

function isInvalid(form, field) {
  if (field.type === "radio") return field.required && !form.querySelector(`input[name="${field.name}"]:checked`);
  return !field.checkValidity();
}

export function setFieldError(form, field, message) {
  const errorEl = form.querySelector(`#${CSS.escape(errorIdFor(field))}`);
  if (errorEl) errorEl.textContent = message ? `Error: ${message}` : "";
  const group = field.type === "radio" ? [...form.querySelectorAll(`input[name="${field.name}"]`)] : [field];
  group.forEach((f) => (message ? f.setAttribute("aria-invalid", "true") : f.removeAttribute("aria-invalid")));
  field.closest("fieldset[data-group]")?.classList.toggle("has-error", Boolean(message));
}

function renderSummary(form, problems) {
  const summary = form.querySelector(".error-summary");
  if (!summary) return;
  const list = summary.querySelector("ul");
  list.replaceChildren();
  summary.hidden = problems.length === 0;
  for (const { field, message } of problems) {
    const link = document.createElement("a");
    link.href = `#${field.id}`;
    link.textContent = message;
    link.addEventListener("click", (event) => { event.preventDefault(); field.focus(); });
    const li = document.createElement("li");
    li.append(link);
    list.append(li);
  }
  if (problems.length) summary.focus();
}

/**
 * @param {HTMLFormElement} form
 * @param {(values: object, helpers: {showErrors: Function}) => Promise|void} onSubmit
 */
export function bindForm(form, onSubmit) {
  form.noValidate = true;

  const showErrors = (byName) => {
    const problems = Object.entries(byName).map(([name, message]) => {
      const item = form.elements[name];
      const field = item instanceof RadioNodeList ? item[0] : item; // a <select> also has .length, so check the type
      setFieldError(form, field, message);
      return { field, message };
    });
    renderSummary(form, problems);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const problems = [];
    for (const field of checkables(form)) {
      if (isInvalid(form, field)) {
        setFieldError(form, field, field.dataset.error);
        problems.push({ field, message: field.dataset.error });
      } else {
        setFieldError(form, field, "");
      }
    }
    renderSummary(form, problems);
    if (problems.length) return;

    const values = Object.fromEntries(new FormData(form));
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    form.setAttribute("aria-busy", "true");
    try {
      await onSubmit(values, { showErrors });
    } finally {
      submit.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });

  // Clear a field's error as soon as it's fixed
  form.addEventListener("input", (event) => {
    const field = event.target.type === "radio"
      ? form.querySelector(`input[name="${event.target.name}"][data-error]`)
      : event.target;
    if (field?.getAttribute?.("aria-invalid") === "true" && !isInvalid(form, field)) setFieldError(form, field, "");
  });
}

/**
 * Markup for one labelled field. Only call with fixed strings from this codebase.
 */
export function fieldHTML({ id, name = id, label, type = "text", hint = "", error, required = true, attrs = "", optional = false, textarea = false, select = "" }) {
  const described = [hint ? `${id}-hint` : "", `${id}-error`].filter(Boolean).join(" ");
  const req = required ? " required" : "";
  const mark = required ? ' <span class="required-mark" aria-hidden="true">*</span>' : optional ? ' <span class="optional">(optional)</span>' : "";
  const errAttr = error ? ` data-error="${error}"` : "";
  const control = textarea
    ? `<textarea id="${id}" name="${name}"${req}${errAttr} aria-describedby="${described}" ${attrs}></textarea>`
    : select
      ? `<select id="${id}" name="${name}"${req}${errAttr} aria-describedby="${described}" ${attrs}>${select}</select>`
      : `<input id="${id}" name="${name}" type="${type}"${req}${errAttr} aria-describedby="${described}" ${attrs}>`;
  return `<div class="field">
      <label for="${id}">${label}${mark}</label>
      ${hint ? `<span id="${id}-hint" class="hint">${hint}</span>` : ""}
      ${control}
      <p id="${id}-error" class="error-message"></p>
    </div>`;
}

export const errorSummaryHTML = (heading = "Fix these to continue") =>
  `<div class="error-summary" tabindex="-1" hidden><h2>${heading}</h2><ul></ul></div>`;
