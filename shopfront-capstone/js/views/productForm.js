/** Add / edit product form in a modal dialog (admin). */
import { el, categoryName } from "../lib/dom.js";
import { template } from "../lib/dom.js";
import { openModal } from "../lib/dialogs.js";
import { bindForm, fieldHTML, errorSummaryHTML } from "../lib/forms.js";

export function openProductForm({ product = null, categories = [], onSave }) {
  const editing = Boolean(product);
  const form = el("form", { class: "form", id: "product-form" });
  form.append(template(`
    <div class="modal__body">
      <h2 id="product-form-title"></h2>
      ${errorSummaryHTML("Fix these before saving")}
      ${fieldHTML({ id: "pf-title", name: "title", label: "Product name", error: "Enter a product name between 3 and 120 characters", attrs: 'minlength="3" maxlength="120" autocomplete="off"' })}
      <div class="field-row">
        ${fieldHTML({ id: "pf-price", name: "price", label: "Price (USD)", type: "number", hint: "For example 24.99", error: "Enter a price between 0.01 and 100,000", attrs: 'min="0.01" max="100000" step="0.01" inputmode="decimal"' })}
        ${fieldHTML({ id: "pf-category", name: "category", label: "Category", hint: "Pick one or type a new one", error: "Enter a category", attrs: 'list="pf-categories" maxlength="40" autocomplete="off"' })}
      </div>
      <datalist id="pf-categories"></datalist>
      ${fieldHTML({ id: "pf-description", name: "description", label: "Description", textarea: true, required: false, optional: true, hint: "Up to 1,000 characters", attrs: 'maxlength="1000" rows="4"' })}
      ${fieldHTML({ id: "pf-image", name: "image", label: "Image address", type: "url", required: false, optional: true, hint: "Must start with https://", error: "Enter an image address starting with https://", attrs: 'pattern="https://.+" autocomplete="off"' })}
    </div>
    <div class="modal__actions">
      <button class="button button--quiet" type="button" data-cancel>Cancel</button>
      <button class="button" type="submit"></button>
    </div>`));

  form.querySelector("#product-form-title").textContent = editing ? "Edit product" : "Add a product";
  form.querySelector('[type="submit"]').textContent = editing ? "Save changes" : "Add product";
  form.querySelector("#pf-categories").append(...categories.map((c) => el("option", { value: categoryName(c) })));
  if (editing) {
    form.elements.title.value = product.title;
    form.elements.price.value = product.price;
    form.elements.category.value = categoryName(product.category);
    form.elements.description.value = product.description ?? "";
    form.elements.image.value = product.image ?? "";
  }

  const dialog = openModal({ labelledBy: "product-form-title", body: form });
  form.querySelector("[data-cancel]").addEventListener("click", () => dialog.close("cancel"));
  form.elements.title.focus();

  bindForm(form, (values, { showErrors }) => {
    const result = onSave(values);
    if (result?.errors) { showErrors(result.errors); return; }
    dialog.close("saved");
  });
}
