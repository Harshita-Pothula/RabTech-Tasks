/** Cart page: change quantities, remove items, go to checkout. */
import { el, hidden, formatPrice, productImage } from "../lib/dom.js";
import { cartCount, cartTotal } from "../lib/cart.js";
import { pageHeading } from "./shared.js";

export const title = "Your cart";

export function render(ctx) {
  const { root, store, actions } = ctx;
  root.append(pageHeading("Your cart"));
  const body = el("div", { class: "cart-page" });
  root.append(body);

  function draw() {
    const { cart, user } = store.get();
    if (!cart.length) {
      body.replaceChildren(el("div", { class: "empty-state" },
        el("p", { class: "empty-state__title", text: "Your cart is empty." }),
        el("p", { text: "Products you add are saved on this device, even after you close the browser." }),
        el("a", { class: "button", href: "#/", text: "Browse the shop" })));
      return;
    }
    body.replaceChildren(
      el("ul", { class: "cart-list" }, cart.map((item) => el("li", { class: "cart-item", "data-item": item.id },
        productImage(item, { size: 80 }),
        el("div", { class: "cart-item__info" },
          el("a", { class: "cart-item__title", href: `#/product/${item.id}`, text: item.title }),
          el("p", { class: "cart-item__price", text: `${formatPrice(item.price)} each` })),
        el("div", { class: "stepper", role: "group", "aria-label": `Quantity of ${item.title}` },
          el("button", { type: "button", class: "stepper__button", "data-dec": item.id, "aria-label": `Decrease quantity of ${item.title}`, text: "−" }),
          el("span", { class: "stepper__value", text: String(item.quantity) }),
          el("button", { type: "button", class: "stepper__button", "data-inc": item.id, "aria-label": `Increase quantity of ${item.title}`, text: "+" })),
        el("p", { class: "cart-item__total", text: formatPrice(item.price * item.quantity) }),
        el("button", { type: "button", class: "link-button", "data-remove": item.id }, "Remove", hidden(` ${item.title}`))))),
      el("aside", { class: "summary", "aria-labelledby": "summary-title" },
        el("h2", { id: "summary-title", text: "Summary" }),
        el("dl", { class: "summary__rows" },
          el("div", {}, el("dt", { text: `Items (${cartCount(cart)})` }), el("dd", { text: formatPrice(cartTotal(cart)) })),
          el("div", {}, el("dt", { text: "Delivery" }), el("dd", { text: "Chosen at checkout" }))),
        el("a", { class: "button button--block", href: "#/checkout", text: user ? "Go to checkout" : "Sign in to check out" }),
        el("button", { class: "link-button", type: "button", "data-empty": true, text: "Empty cart" })));
  }

  body.addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    const { cart } = store.get();
    const focusAfter = (selector) => requestAnimationFrame(() => (body.querySelector(selector) ?? root.querySelector("h1")).focus());
    if (b.dataset.inc) { actions.changeQuantity(Number(b.dataset.inc), +1); focusAfter(`[data-inc="${b.dataset.inc}"]`); }
    else if (b.dataset.dec) { actions.changeQuantity(Number(b.dataset.dec), -1); focusAfter(`[data-dec="${b.dataset.dec}"]`); }
    else if (b.dataset.remove) { actions.removeFromCart(Number(b.dataset.remove)); focusAfter("h1"); }
    else if ("empty" in b.dataset && cart.length) { actions.emptyCart(); focusAfter("h1"); }
  });

  draw();
  return store.subscribe((s, p) => { if (s.cart !== p.cart || s.user !== p.user) draw(); });
}
