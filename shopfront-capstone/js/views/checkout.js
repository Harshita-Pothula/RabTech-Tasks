/** Checkout (signed-in users): delivery details, delivery speed, payment, order summary. */
import { el, formatPrice, template } from "../lib/dom.js";
import { cartTotal } from "../lib/cart.js";
import { bindForm, fieldHTML, errorSummaryHTML } from "../lib/forms.js";
import { SHIPPING, PAYMENT } from "../services/orders.js";
import { pageHeading } from "./shared.js";

export const title = "Checkout";

export function render(ctx) {
  const { root, store, actions, router, toast } = ctx;
  const { cart, user } = store.get();
  root.append(pageHeading("Checkout"));

  if (!cart.length) {
    root.append(el("div", { class: "empty-state" },
      el("p", { class: "empty-state__title", text: "Your cart is empty." }),
      el("p", { text: "Add something before checking out." }),
      el("a", { class: "button", href: "#/", text: "Browse the shop" })));
    return;
  }

  const form = el("form", { class: "form checkout-form", id: "checkout-form" });
  form.append(template(`
    ${errorSummaryHTML("Fix these to place your order")}
    <fieldset>
      <legend>Delivery details</legend>
      ${fieldHTML({ id: "co-name", name: "name", label: "Full name", error: "Enter the name of the person receiving the order", attrs: 'autocomplete="name" minlength="2" maxlength="80"' })}
      ${fieldHTML({ id: "co-phone", name: "phone", label: "Mobile number", type: "tel", hint: "10 digits, starting with 6, 7, 8 or 9", error: "Enter a 10-digit mobile number starting with 6, 7, 8 or 9", attrs: 'autocomplete="tel" inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10"' })}
      ${fieldHTML({ id: "co-address", name: "address", label: "Address", hint: "House number, street and area", error: "Enter your street address", attrs: 'autocomplete="street-address" minlength="5" maxlength="160"' })}
      <div class="field-row">
        ${fieldHTML({ id: "co-city", name: "city", label: "City", error: "Enter your city", attrs: 'autocomplete="address-level2" minlength="2" maxlength="60"' })}
        ${fieldHTML({ id: "co-pin", name: "pin", label: "PIN code", error: "Enter a 6-digit PIN code", attrs: 'autocomplete="postal-code" inputmode="numeric" pattern="[1-9][0-9]{5}" maxlength="6"' })}
      </div>
    </fieldset>
    <fieldset data-group>
      <legend>Delivery speed <span class="required-mark" aria-hidden="true">*</span></legend>
      <ul class="choices" data-shipping></ul>
      <p id="shipping-error" class="error-message"></p>
    </fieldset>
    <fieldset data-group>
      <legend>Payment <span class="required-mark" aria-hidden="true">*</span></legend>
      <p class="fieldset-hint">You pay when the order arrives. No card details are needed.</p>
      <ul class="choices" data-payment></ul>
      <p id="payment-error" class="error-message"></p>
    </fieldset>
    <button class="button button--block" type="submit">Place order</button>`));

  const radio = (name, value, label, first, error) => el("li", { class: "choice" },
    el("input", {
      id: `${name}-${value}`, type: "radio", name, value, required: first, checked: first,
      "aria-describedby": `${name}-error`, ...(first ? { "data-error": error, "data-error-target": `${name}-error` } : {}),
    }),
    el("label", { for: `${name}-${value}`, text: label }));

  form.querySelector("[data-shipping]").append(...Object.entries(SHIPPING).map(([value, o], i) =>
    radio("shipping", value, `${o.label}: ${o.price ? formatPrice(o.price) : "Free"}`, i === 0, "Choose a delivery speed")));
  form.querySelector("[data-payment]").append(...Object.entries(PAYMENT).map(([value, label], i) =>
    radio("payment", value, label, i === 0, "Choose how you'll pay")));
  form.elements.name.value = user.name;

  const subtotal = cartTotal(cart);
  const shippingRow = el("dd", { text: "Free" });
  const totalRow = el("dd", { text: formatPrice(subtotal) });
  const summary = el("aside", { class: "summary", "aria-labelledby": "co-summary" },
    el("h2", { id: "co-summary", text: "Order summary" }),
    el("ul", { class: "summary__items" }, cart.map((i) => el("li", {},
      el("span", { text: `${i.quantity} × ${i.title}` }), el("span", { text: formatPrice(i.price * i.quantity) })))),
    el("dl", { class: "summary__rows" },
      el("div", {}, el("dt", { text: "Subtotal" }), el("dd", { text: formatPrice(subtotal) })),
      el("div", {}, el("dt", { text: "Delivery" }), shippingRow),
      el("div", { class: "summary__total" }, el("dt", { text: "Total" }), totalRow)),
    el("p", { class: "back-link" }, el("a", { href: "#/cart", text: "Edit cart" })));

  form.addEventListener("change", () => {
    const cost = SHIPPING[form.elements.shipping.value]?.price ?? 0;
    shippingRow.textContent = cost ? formatPrice(cost) : "Free";
    totalRow.textContent = formatPrice(Math.round((subtotal + cost) * 100) / 100);
  });

  bindForm(form, (values) => {
    const order = actions.placeOrder(values);
    if (!order) return;
    toast(`Order ${order.id} placed.`);
    router.navigate(`/orders/${order.id}`);
  });

  // Summary comes first in the page, so phone users see the total before the "Place order" button.
  // On wide screens CSS moves it into the right-hand column.
  root.append(el("div", { class: "checkout-layout" }, summary, form));
}
