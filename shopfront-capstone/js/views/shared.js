/** Pieces used by several views. */
import { el, hidden, formatPrice, categoryName, productImage } from "../lib/dom.js";
import { quantityOf } from "../lib/cart.js";
import { describeError } from "../api.js";

export function pageHeading(text, intro) {
  return el("div", { class: "page-head" },
    el("h1", { tabindex: "-1", text }),
    intro ? el("p", { class: "page-intro", text: intro }) : null);
}

export function productCard(product, cart) {
  const qty = quantityOf(cart, product.id);
  return el("li", { class: "product-card", "data-product-id": product.id },
    productImage(product),
    el("p", { class: "product-card__category", text: categoryName(product.category) }),
    el("h3", { class: "product-card__title" }, el("a", { href: `#/product/${product.id}`, text: product.title })),
    product.rating?.count
      ? el("p", { class: "product-card__rating" },
          el("span", { "aria-hidden": "true", text: `★ ${product.rating.rate.toFixed(1)} (${product.rating.count})` }),
          hidden(`Rated ${product.rating.rate} out of 5 from ${product.rating.count} reviews`))
      : el("p", { class: "product-card__rating product-card__rating--new", text: product.local ? "New in store" : "No reviews yet" }),
    el("p", { class: "product-card__price", text: formatPrice(product.price) }),
    el("div", { class: "product-card__buy" },
      el("button", { type: "button", class: "button button--small", "data-add-to-cart": product.id },
        qty ? "Add another" : "Add to cart", hidden(`: ${product.title}`)),
      qty ? el("span", { class: "in-cart", text: `${qty} in cart` }) : null));
}

export function skeletonCards(count = 8) {
  return Array.from({ length: count }, () => el("li", { class: "product-card product-card--skeleton", "aria-hidden": "true" },
    el("span", { class: "skeleton skeleton--image" }),
    el("span", { class: "skeleton skeleton--line" }),
    el("span", { class: "skeleton skeleton--line skeleton--short" }),
    el("span", { class: "skeleton skeleton--button" })));
}

/** Error or stale-data banner for catalog loading, or nothing. */
export function catalogBanner(catalog, onRetry) {
  if (catalog.status === "error") {
    const { title, message } = describeError(catalog.error);
    return el("div", { class: "banner banner--error", role: "alert" },
      el("div", { class: "banner__text" }, el("strong", { text: title }), ` ${message}`),
      el("button", { type: "button", class: "button button--small", text: "Try again", onclick: onRetry }));
  }
  if (catalog.status === "ready" && catalog.source === "stale") {
    const minutes = Math.max(1, Math.round((Date.now() - catalog.savedAt) / 60000));
    return el("div", { class: "banner banner--warning", role: "status" },
      el("div", { class: "banner__text" }, el("strong", { text: "Showing saved products." }),
        ` ${describeError(catalog.error).title}, so this list is from ${minutes} minute${minutes === 1 ? "" : "s"} ago.`),
      el("button", { type: "button", class: "button button--small", text: "Refresh", onclick: onRetry }));
  }
  if (catalog.status === "ready" && catalog.source === "bundled") {
    return el("div", { class: "banner banner--warning", role: "status" },
      el("div", { class: "banner__text" }, el("strong", { text: "Showing the saved catalog." }),
        ` ${describeError(catalog.error).title}, so you're seeing a built-in copy of the products. Everything else works normally.`),
      el("button", { type: "button", class: "button button--small", text: "Try live data", onclick: onRetry }));
  }
  return null;
}
