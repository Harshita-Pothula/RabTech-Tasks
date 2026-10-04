/**
 * app.js
 * Entry point: loads data, keeps state, and connects events to the UI.
 * Flow: user action -> store.set() -> subscribers re-render the parts that changed.
 */
import { getProducts, getCategories, describeError, clearCache } from "./api.js";
import { applyView, countByCategory } from "./filters.js";
import { addItem, setQuantity, removeItem, quantityOf, cartCount } from "./cart.js";
import {
  createStore, loadCart, saveCart, loadPrefs, savePrefs, resetSavedData,
  readViewFromURL, writeViewToURL, onCartChangedElsewhere,
} from "./state.js";
import * as ui from "./ui.js";

/* ---------- demo modes for reviewers: ?demo=slow | error | offline ---------- */
const demo = new URLSearchParams(location.search).get("demo");
const demoFetch = async (url, init) => {
  if (demo === "slow") await new Promise((r) => setTimeout(r, 2500));
  if (demo === "error") return new Response("Service unavailable", { status: 503 });
  return fetch(url, init);
};
const apiOptions = {
  fetchImpl: demoFetch,
  forceRefresh: Boolean(demo),               // demo modes skip the cache
  ...(demo === "offline" && { isOnline: () => false }),
  ...(demo === "error" && { retries: 0 }),
};

/* ---------- state ---------- */
const prefs = loadPrefs();
const store = createStore({
  status: "loading",          // loading | ready | error
  products: [],
  categories: [],
  query: "",
  category: prefs.category,
  sort: prefs.sort,
  ...readViewFromURL(),       // a shared link wins over saved preferences
  cart: loadCart(),
});

let productsById = new Map();

/* ---------- loading ---------- */
async function load({ forceRefresh = false } = {}) {
  store.set({ status: "loading" });
  ui.hideBanner();
  ui.renderSkeleton();
  ui.setStatus("Loading products…");

  const options = { ...apiOptions, forceRefresh: forceRefresh || apiOptions.forceRefresh };
  const [productsResult, categoriesResult] = await Promise.allSettled([getProducts(options), getCategories(options)]);

  if (productsResult.status === "rejected") {
    const { title, message } = describeError(productsResult.reason);
    store.set({ status: "error" });
    ui.renderLoadError();
    ui.setStatus("");
    ui.showBanner({ tone: "error", title, message, actionLabel: "Try again", onAction: () => load({ forceRefresh: true }) });
    return;
  }

  const { data: products, source, savedAt, error } = productsResult.value;
  // If only the categories request failed, work them out from the products instead
  const categories = categoriesResult.status === "fulfilled"
    ? categoriesResult.value.data
    : [...new Set(products.map((p) => p.category))].sort();

  productsById = new Map(products.map((p) => [p.id, p]));
  const { category } = store.get();
  store.set({
    status: "ready",
    products,
    categories,
    category: category === "all" || categories.includes(category) ? category : "all",
  });

  if (source === "stale") {
    const minutes = Math.max(1, Math.round((Date.now() - savedAt) / 60000));
    ui.showBanner({
      tone: "warning",
      title: "Showing saved products.",
      message: `${describeError(error).title}, so this list is from ${minutes} minute${minutes === 1 ? "" : "s"} ago.`,
      actionLabel: "Refresh",
      onAction: () => load({ forceRefresh: true }),
    });
  }
}

/* ---------- rendering ---------- */
function renderView(state) {
  if (state.status !== "ready") return;
  const visible = applyView(state.products, state);
  ui.renderTabs(state.categories, state.category, countByCategory(state.products));
  ui.renderProducts(visible, state.cart);
  if (!visible.length) ui.renderEmptyState(state);

  const where = state.category === "all" ? "" : ` in ${ui.categoryName(state.category)}`;
  const matching = state.query ? ` matching “${state.query}”` : "";
  ui.setStatus(`Showing ${visible.length} of ${state.products.length} products${where}${matching}.`);
}

store.subscribe((state, previous) => {
  const viewChanged = ["status", "products", "query", "category", "sort"].some((k) => state[k] !== previous[k]);
  if (viewChanged) {
    renderView(state);
    writeViewToURL(state);
  }
  if (state.category !== previous.category || state.sort !== previous.sort) savePrefs(state);
  if (state.cart !== previous.cart) {
    saveCart(state.cart);
    ui.renderCartCount(state.cart);
    ui.refreshCardButtons(state.cart, productsById);
    if (ui.els.cartDialog.open) ui.renderCart(state.cart);
  }
});

/* ---------- events: search, tabs, sort ---------- */
let searchTimer;
ui.els.search.value = store.get().query;
ui.els.search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => store.set({ query: ui.els.search.value.trim() }), 150); // debounce typing
});

// Press "/" anywhere (outside a text field) to jump to search
document.addEventListener("keydown", (event) => {
  const typing = event.target.closest("input, textarea, select, [contenteditable]");
  if (event.key === "/" && !typing && !ui.els.cartDialog.open) {
    event.preventDefault();
    ui.els.search.focus();
  }
});

ui.els.tabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[role=tab]");
  if (!tab) return;
  store.set({ category: tab.dataset.category });
  // tabs are re-rendered, so put focus back on the newly selected one
  ui.els.tabs.querySelector(`[data-category="${CSS.escape(tab.dataset.category)}"]`)?.focus();
});

// Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern)
ui.els.tabs.addEventListener("keydown", (event) => {
  const tabs = [...ui.els.tabs.querySelectorAll("[role=tab]")];
  const index = tabs.indexOf(document.activeElement);
  if (index === -1) return;
  const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 }[event.key];
  if (next === undefined) return;
  event.preventDefault();
  const target = tabs[(next + tabs.length) % tabs.length];
  store.set({ category: target.dataset.category });
  ui.els.tabs.querySelector(`[data-category="${CSS.escape(target.dataset.category)}"]`).focus();
});

ui.els.sort.value = store.get().sort;
ui.els.sort.addEventListener("change", () => store.set({ sort: ui.els.sort.value }));

ui.els.empty.addEventListener("click", (event) => {
  if (event.target.closest("[data-clear-search]")) {
    ui.els.search.value = "";
    store.set({ query: "" });
    ui.els.search.focus();
  }
  if (event.target.closest("[data-show-all]")) store.set({ category: "all" });
});

/* ---------- events: cart ---------- */
ui.els.grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add-to-cart]");
  if (!button) return;
  const product = productsById.get(Number(button.dataset.addToCart));
  const cart = addItem(store.get().cart, product);
  store.set({ cart });
  ui.announce(`Added ${product.title} to your cart. ${cartCount(cart)} items in cart.`);
});

ui.els.cartButton.addEventListener("click", () => {
  ui.renderCart(store.get().cart);
  ui.els.cartDialog.showModal();
  ui.els.cartDialog.querySelector("#cart-title").focus();
});

ui.els.cartDialog.addEventListener("click", (event) => {
  const { cart } = store.get();
  const target = event.target.closest("button");
  if (!target) {
    if (event.target === ui.els.cartDialog) ui.els.cartDialog.close(); // click on the backdrop
    return;
  }
  const id = (attr) => Number(target.dataset[attr]);

  if (target.dataset.qtyInc) {
    const next = setQuantity(cart, id("qtyInc"), quantityOf(cart, id("qtyInc")) + 1);
    store.set({ cart: next });
    ui.announce(`Quantity ${quantityOf(next, id("qtyInc"))}.`);
    ui.els.cartDialog.querySelector(`[data-qty-inc="${id("qtyInc")}"]`)?.focus();
  } else if (target.dataset.qtyDec) {
    const next = setQuantity(cart, id("qtyDec"), quantityOf(cart, id("qtyDec")) - 1);
    store.set({ cart: next });
    const button = ui.els.cartDialog.querySelector(`[data-qty-dec="${id("qtyDec")}"]`);
    if (button) { button.focus(); ui.announce(`Quantity ${quantityOf(next, id("qtyDec"))}.`); }
    else { ui.els.cartDialog.querySelector("#cart-title").focus(); ui.announce("Item removed from your cart."); }
  } else if (target.dataset.remove) {
    store.set({ cart: removeItem(cart, id("remove")) });
    ui.els.cartDialog.querySelector("#cart-title").focus();
    ui.announce("Item removed from your cart.");
  } else if ("emptyCart" in target.dataset) {
    store.set({ cart: [] });
    ui.els.cartDialog.querySelector("#cart-title").focus();
    ui.announce("Your cart is now empty.");
  } else if ("closeDialog" in target.dataset) {
    ui.els.cartDialog.close();
  }
});

onCartChangedElsewhere((cart) => store.set({ cart })); // keep tabs in sync

document.querySelector("[data-reset-saved]").addEventListener("click", () => {
  resetSavedData();
  clearCache();
  ui.els.search.value = "";
  ui.els.sort.value = "featured";
  store.set({ cart: [], query: "", category: "all", sort: "featured" });
  ui.announce("Saved cart, preferences and cached products were cleared.");
});

/* ---------- start ---------- */
ui.renderTabSkeleton();
ui.renderCartCount(store.get().cart);
load();
