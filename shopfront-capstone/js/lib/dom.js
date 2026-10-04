/**
 * dom.js
 * Small DOM helpers. Data from users or the API is only ever placed with
 * textContent or attributes (never innerHTML), which prevents HTML injection.
 * template() is only used with fixed markup written in this codebase.
 */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "for") node.htmlFor = value;
    else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2), value);
    else if (key.startsWith("data-") || key.startsWith("aria-") || key === "role" || key === "href" || key === "datetime" || key === "tabindex") {
      node.setAttribute(key, value === true ? "" : value);
    } else node[key] = value;
  }
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

export const hidden = (text) => el("span", { class: "visually-hidden", text });

/** Build DOM from a fixed markup string (never pass user or API data here). */
export function template(markup) {
  const t = document.createElement("template");
  t.innerHTML = markup.trim();
  return t.content;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const formatPrice = (value) => money.format(value);

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const formatDate = (ts) => dateFormat.format(ts);
export const formatDateTime = (ts) => dateTimeFormat.format(ts);
export const timeEl = (ts, withTime = false) =>
  el("time", { datetime: new Date(ts).toISOString(), text: withTime ? formatDateTime(ts) : formatDate(ts) });

const CATEGORY_NAMES = {
  all: "All", electronics: "Electronics", jewelery: "Jewellery",
  "men's clothing": "Men's clothing", "women's clothing": "Women's clothing",
};
export const categoryName = (key = "") => CATEGORY_NAMES[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
/** Turns a typed or displayed name back into the stored key, e.g. "Jewellery" -> "jewelery". */
export function categoryKey(input = "", known = []) {
  const typed = input.trim().toLowerCase();
  return known.find((key) => key === typed || categoryName(key).toLowerCase() === typed) ?? typed;
}
export const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/** Product image with a graceful fallback when there's no image or it fails to load. */
export function productImage(product, { size = 160, eager = false } = {}) {
  const box = el("div", { class: "product-image" });
  const fallback = () => box.replaceChildren(el("span", { class: "product-image__none", text: "No image" }));
  if (!product.image) { fallback(); return box; }
  const img = el("img", { src: product.image, alt: "", width: size, height: size, loading: eager ? "eager" : "lazy", decoding: "async" });
  img.addEventListener("error", fallback, { once: true });
  box.append(img);
  return box;
}

export const statusBadge = (status, label) => el("span", { class: `badge badge--${status}`, text: label });
