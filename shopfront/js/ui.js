/**
 * ui.js
 * Everything that touches the DOM. Builds elements with textContent
 * (never innerHTML with API data), so product text can't inject HTML.
 */
import { quantityOf, cartCount, cartTotal } from "./cart.js";

const $ = (selector) => document.querySelector(selector);

export const els = {
  search: $("#search"),
  tabs: $("#category-tabs"),
  sort: $("#sort"),
  panel: $("#product-panel"),
  grid: $("#product-grid"),
  empty: $("#empty-state"),
  status: $("#results-status"),
  announcer: $("#announcer"),
  banner: $("#banner"),
  cartButton: $("#cart-button"),
  cartCount: $("#cart-count"),
  cartDialog: $("#cart-dialog"),
  cartItems: $("#cart-items"),
  cartTotal: $("#cart-total"),
  cartFooter: $("#cart-footer"),
  cartEmpty: $("#cart-empty"),
};

const price = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (value) => price.format(value);

const CATEGORY_NAMES = {
  all: "All",
  electronics: "Electronics",
  jewelery: "Jewellery",
  "men's clothing": "Men's clothing",
  "women's clothing": "Women's clothing",
};
export const categoryName = (key) => CATEGORY_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("data-") || key.startsWith("aria-") || key === "role") node.setAttribute(key, value === true ? "" : value);
    else node[key] = value;
  }
  node.append(...children.filter(Boolean));
  return node;
}
const hidden = (text) => el("span", { class: "visually-hidden", text });

/* ---------- live regions ---------- */

export const setStatus = (text) => { els.status.textContent = text; };

/** Short announcements (cart changes). Cleared first so repeats are re-announced. */
export function announce(text) {
  els.announcer.textContent = "";
  requestAnimationFrame(() => { els.announcer.textContent = text; });
}

/* ---------- category tabs (ARIA tabs pattern) ---------- */

export function renderTabSkeleton() {
  els.tabs.replaceChildren(...Array.from({ length: 5 }, () => el("span", { class: "tab tab--skeleton", "aria-hidden": "true" })));
}

export function renderTabs(categories, active, counts) {
  const keys = ["all", ...categories];
  els.tabs.replaceChildren(...keys.map((key) => {
    const selected = key === active;
    return el("button", {
      type: "button",
      class: "tab",
      id: `tab-${slug(key)}`,
      role: "tab",
      "aria-selected": String(selected),
      "aria-controls": "product-panel",
      tabIndex: selected ? 0 : -1,
      "data-category": key,
    }, categoryName(key), el("span", { class: "tab__count", text: String(counts[key] ?? 0) }));
  }));
  els.panel.setAttribute("aria-labelledby", `tab-${slug(active)}`);
}

/* ---------- product grid ---------- */

export function renderSkeleton(count = 8) {
  els.panel.setAttribute("aria-busy", "true");
  els.empty.hidden = true;
  els.grid.replaceChildren(...Array.from({ length: count }, () =>
    el("li", { class: "product-card product-card--skeleton", "aria-hidden": "true" },
      el("span", { class: "skeleton skeleton--image" }),
      el("span", { class: "skeleton skeleton--line" }),
      el("span", { class: "skeleton skeleton--line skeleton--short" }),
      el("span", { class: "skeleton skeleton--button" }))));
}

function cartButtonFor(product, cart) {
  const qty = quantityOf(cart, product.id);
  return el("div", { class: "product-card__buy" },
    el("button", { type: "button", class: "button button--small", "data-add-to-cart": product.id },
      qty ? "Add another" : "Add to cart", hidden(`: ${product.title}`)),
    qty ? el("span", { class: "in-cart", text: `${qty} in cart` }) : null);
}

function productCard(product, cart) {
  const img = el("img", {
    src: product.image, alt: "", loading: "lazy", decoding: "async", width: 160, height: 160,
  });
  img.addEventListener("error", () => img.replaceWith(el("span", { class: "product-card__no-image", text: "No image" })), { once: true });

  return el("li", { class: "product-card", "data-product-id": product.id },
    el("div", { class: "product-card__image" }, img),
    el("p", { class: "product-card__category", text: categoryName(product.category) }),
    el("h3", { class: "product-card__title", text: product.title }),
    el("p", { class: "product-card__rating" },
      el("span", { "aria-hidden": "true", text: `★ ${product.rating.rate.toFixed(1)} (${product.rating.count})` }),
      hidden(`Rated ${product.rating.rate} out of 5 from ${product.rating.count} reviews`)),
    el("p", { class: "product-card__price", text: formatPrice(product.price) }),
    cartButtonFor(product, cart));
}

export function renderProducts(products, cart) {
  els.panel.setAttribute("aria-busy", "false");
  els.empty.hidden = products.length > 0;
  els.grid.replaceChildren(...products.map((p) => productCard(p, cart)));
}

/** After a cart change, update only the buttons (keeps keyboard focus in place). */
export function refreshCardButtons(cart, productsById) {
  els.grid.querySelectorAll("[data-product-id]").forEach((card) => {
    const product = productsById.get(Number(card.dataset.productId));
    if (!product) return;
    const hadFocus = card.contains(document.activeElement);
    card.querySelector(".product-card__buy").replaceWith(cartButtonFor(product, cart));
    if (hadFocus) card.querySelector("[data-add-to-cart]").focus();
  });
}

export function renderEmptyState({ query, category }) {
  const where = category === "all" ? "" : ` in ${categoryName(category)}`;
  els.empty.querySelector("[data-empty-message]").textContent =
    query ? `No products match “${query}”${where}.` : `There are no products${where}.`;
  els.empty.querySelector("[data-clear-search]").hidden = !query;
  els.empty.querySelector("[data-show-all]").hidden = category === "all";
}

/* ---------- banner ---------- */

/**
 * @param {{tone: "error"|"warning", title: string, message: string, actionLabel?: string, onAction?: Function}} opts
 */
export function showBanner({ tone, title, message, actionLabel, onAction }) {
  const action = actionLabel
    ? el("button", { type: "button", class: "button button--small", text: actionLabel, onclick: onAction })
    : null;
  els.banner.className = `banner banner--${tone}`;
  els.banner.setAttribute("role", tone === "error" ? "alert" : "status");
  els.banner.replaceChildren(
    el("div", { class: "banner__text" }, el("strong", { text: title }), el("span", { text: ` ${message}` })),
    action);
  els.banner.hidden = false;
}

export function hideBanner() {
  els.banner.hidden = true;
  els.banner.replaceChildren();
}

export function renderLoadError() {
  els.panel.setAttribute("aria-busy", "false");
  els.tabs.replaceChildren();          // stop the loading shimmer: nothing is loading now
  els.grid.replaceChildren();
  els.empty.hidden = true;
}

/* ---------- cart ---------- */

export function renderCartCount(cart) {
  const count = cartCount(cart);
  els.cartCount.textContent = String(count);
  els.cartCount.dataset.empty = String(count === 0);
  els.cartButton.querySelector("[data-cart-label]").textContent = ` ${count === 1 ? "item" : "items"}`;
}

export function renderCart(cart) {
  const isEmpty = cart.length === 0;
  els.cartEmpty.hidden = !isEmpty;
  els.cartFooter.hidden = isEmpty;
  els.cartTotal.textContent = formatPrice(cartTotal(cart));
  els.cartItems.replaceChildren(...cart.map((item) =>
    el("li", { class: "cart-item", "data-cart-item": item.id },
      el("img", { src: item.image, alt: "", width: 56, height: 56, loading: "lazy" }),
      el("div", { class: "cart-item__info" },
        el("p", { class: "cart-item__title", text: item.title }),
        el("p", { class: "cart-item__price", text: `${formatPrice(item.price)} each` })),
      el("div", { class: "stepper", role: "group", "aria-label": `Quantity of ${item.title}` },
        el("button", { type: "button", class: "stepper__button", "data-qty-dec": item.id, "aria-label": `Decrease quantity of ${item.title}`, text: "−" }),
        el("span", { class: "stepper__value", text: String(item.quantity) }),
        el("button", { type: "button", class: "stepper__button", "data-qty-inc": item.id, "aria-label": `Increase quantity of ${item.title}`, text: "+" })),
      el("p", { class: "cart-item__total", text: formatPrice(item.price * item.quantity) }),
      el("button", { type: "button", class: "link-button", "data-remove": item.id }, "Remove", hidden(` ${item.title}`)))));
}
