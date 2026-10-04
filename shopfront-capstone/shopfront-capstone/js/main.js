/**
 * main.js
 * Application entry point: creates services and state, defines routes,
 * and implements every user action (cart, auth, products, orders).
 * Views call these actions; they never write to storage directly.
 */
import * as api from "./api.js";
import { createStorage } from "./lib/storage.js";
import { createStore } from "./lib/store.js";
import { el, categoryKey } from "./lib/dom.js";
import { addItem, setQuantity, removeItem, quantityOf, cartCount, sanitizeCart } from "./lib/cart.js";
import { SORT_OPTIONS } from "./lib/filters.js";
import { createAuth, AuthError } from "./services/auth.js";
import { createCatalogService, mergeCatalog } from "./services/catalog.js";
import { createOrderService, OrderError } from "./services/orders.js";
import { createRouter } from "./router.js";
import * as catalogView from "./views/catalog.js";
import * as productView from "./views/product.js";
import * as cartView from "./views/cart.js";
import * as checkoutView from "./views/checkout.js";
import * as orderView from "./views/order.js";
import * as accountView from "./views/account.js";
import * as adminView from "./views/admin.js";
import * as signinView from "./views/signin.js";
import * as signupView from "./views/signup.js";

/* ---------- demo modes for reviewers: ?demo=slow | error | offline ---------- */
const demo = new URLSearchParams(location.search).get("demo");
const apiOptions = {
  timeout: 6000, // give up on a slow API after 6s (1 retry), then fall back to the bundled catalog
  retries: 1,
  forceRefresh: Boolean(demo),
  fetchImpl: async (url, init) => {
    if (demo === "slow") await new Promise((r) => setTimeout(r, 2500));
    if (demo === "error") return new Response("Service unavailable", { status: 503 });
    return fetch(url, init);
  },
  ...(demo === "offline" && { isOnline: () => false }),
  ...(demo === "error" && { retries: 0 }),
};

/* ---------- services ---------- */
const storage = createStorage();
const auth = createAuth({ storage });
const catalogService = createCatalogService({
  storage,
  remote: {
    createProduct: (p) => api.createProduct(p, apiOptions),
    updateProduct: (id, p) => api.updateProduct(id, p, apiOptions),
    deleteProduct: (id) => api.deleteProduct(id, apiOptions),
  },
  onRemoteError: (error) => console.info("FakeStoreAPI sync skipped:", error.message),
});
const orderService = createOrderService({ storage });
const services = { auth, catalog: catalogService, orders: orderService };
const authReady = auth.seedDemoAccounts();

/* ---------- state ---------- */
const cartKey = (user) => `cart:${user ? user.id : "guest"}`;
const initialUser = auth.currentUser();
const savedPrefs = storage.get("prefs", {});

const store = createStore({
  user: initialUser,
  cart: sanitizeCart(storage.get(cartKey(initialUser), [])),
  overlay: catalogService.getOverlay(),
  catalog: { status: "loading", apiProducts: [], categories: [] },
  prefs: {
    category: typeof savedPrefs.category === "string" ? savedPrefs.category : "all",
    sort: savedPrefs.sort in SORT_OPTIONS ? savedPrefs.sort : "featured",
  },
  ordersVersion: 0, // bumped whenever orders change, so views know to redraw
});

const select = {
  products: (s) => mergeCatalog(s.catalog.apiProducts, s.overlay),
  categories: (s) => [...new Set([...s.catalog.categories, ...select.products(s).map((p) => p.category)])].sort(),
};

// Persist the cart whenever it changes
store.subscribe((s, p) => { if (s.cart !== p.cart) storage.set(cartKey(s.user), s.cart); });

/* ---------- toast ---------- */
const toastRegion = document.getElementById("toasts");
function toast(message) {
  const item = el("p", { class: "toast", text: message });
  toastRegion.append(item);
  while (toastRegion.children.length > 3) toastRegion.firstElementChild.remove(); // never cover the page with a pile of messages
  setTimeout(() => item.classList.add("toast--leaving"), 4000);
  setTimeout(() => item.remove(), 4400);
}

/* ---------- actions ---------- */
const bumpOrders = () => store.set((s) => ({ ordersVersion: s.ordersVersion + 1 }));

const actions = {
  async loadCatalog(forceRefresh = false) {
    store.set({ catalog: { ...store.get().catalog, status: "loading" } });
    const options = { ...apiOptions, forceRefresh: forceRefresh || apiOptions.forceRefresh };
    const [products, categories] = await Promise.allSettled([api.getProducts(options), api.getCategories(options)]);
    if (products.status === "rejected") {
      // Last resort: the catalog snapshot shipped with the site, so the store still works
      const bundled = await loadBundledCatalog();
      if (bundled) {
        store.set({ catalog: { status: "ready", source: "bundled", error: products.reason, ...bundled } });
      } else {
        store.set({ catalog: { status: "error", error: products.reason, apiProducts: [], categories: [] } });
      }
      return;
    }
    const { data, source, savedAt, error } = products.value;
    store.set({ catalog: {
      status: "ready", apiProducts: data, source, savedAt, error,
      categories: categories.status === "fulfilled" ? categories.value.data : [],
    } });
  },

  savePrefs(prefs) {
    store.set({ prefs });
    storage.set("prefs", prefs);
  },

  addToCart(productId, amount = 1) {
    const product = select.products(store.get()).find((p) => p.id === productId);
    if (!product) return;
    const cart = addItem(store.get().cart, product, amount);
    store.set({ cart });
    const count = cartCount(cart);
    toast(`Added ${amount > 1 ? `${amount} × ` : ""}${product.title} to your cart. ${count} ${count === 1 ? "item" : "items"} in cart.`);
  },
  changeQuantity(id, delta) {
    const { cart } = store.get();
    store.set({ cart: setQuantity(cart, id, quantityOf(cart, id) + delta) });
  },
  removeFromCart(id) { store.set({ cart: removeItem(store.get().cart, id) }); toast("Item removed from your cart."); },
  emptyCart() { store.set({ cart: [] }); toast("Your cart is now empty."); },

  async signIn(values, remember) {
    await authReady;
    try {
      const user = await auth.signIn(values, { remember });
      afterSignIn(user);
      toast(`Welcome back, ${user.name.split(" ")[0]}.`);
      return { user };
    } catch (error) {
      if (error instanceof AuthError) return { error };
      throw error;
    }
  },
  async signUp(values, remember) {
    await authReady;
    try {
      const user = await auth.signUp(values, { remember });
      afterSignIn(user);
      toast(`Account created. Welcome, ${user.name.split(" ")[0]}.`);
      return { user };
    } catch (error) {
      if (error instanceof AuthError) return { error };
      throw error;
    }
  },
  signOut() {
    auth.signOut();
    store.set({ user: null, cart: sanitizeCart(storage.get(cartKey(null), [])) });
    toast("You're signed out.");
    location.hash = "#/";
  },

  createProduct(values) {
    const known = select.categories(store.get());
    const result = catalogService.create({ ...values, category: categoryKey(values.category, known) });
    if (result.overlay) store.set({ overlay: result.overlay });
    return result;
  },
  saveProduct(id, values) {
    const known = select.categories(store.get());
    const result = catalogService.update(id, { ...values, category: categoryKey(values.category, known) });
    if (result.overlay) store.set({ overlay: result.overlay });
    return result;
  },
  deleteProduct(id) { store.set({ overlay: catalogService.remove(id).overlay }); },
  resetCatalog() { store.set({ overlay: catalogService.reset().overlay }); },

  placeOrder(details) {
    try {
      const order = orderService.place(store.get().user, store.get().cart, details);
      store.set({ cart: [] });
      bumpOrders();
      return order;
    } catch (error) {
      if (error instanceof OrderError) { toast(error.message); return null; }
      throw error;
    }
  },
  cancelOrder(id) { orderService.cancel(store.get().user, id); bumpOrders(); },
  deleteOrder(id) { orderService.remove(store.get().user, id); bumpOrders(); },
  advanceOrder(id) {
    try { const order = orderService.advance(store.get().user, id); bumpOrders(); return order; }
    catch (error) { if (error instanceof OrderError) { toast(error.message); return null; } throw error; }
  },
};

/** Reads the catalog snapshot bundled in /data. Returns null if that fails too. */
async function loadBundledCatalog() {
  try {
    const [products, categories] = await Promise.all(
      ["data/products.json", "data/categories.json"].map((path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(r)))));
    return Array.isArray(products) && products.length ? { apiProducts: products, categories } : null;
  } catch {
    return null;
  }
}

/** Moves anything in the guest cart into the user's own cart. */
function afterSignIn(user) {
  const guestCart = sanitizeCart(storage.get(cartKey(null), []));
  let cart = sanitizeCart(storage.get(cartKey(user), []));
  for (const item of guestCart) cart = addItem(cart, item, item.quantity);
  storage.remove(cartKey(null));
  store.set({ user, cart });
}

/* ---------- routing ---------- */
const routes = [
  { path: "/", view: catalogView, nav: "shop" },
  { path: "/product/:id", view: productView, nav: "shop" },
  { path: "/cart", view: cartView, nav: "cart" },
  { path: "/checkout", view: checkoutView, access: "user", nav: "cart" },
  { path: "/orders/:id", view: orderView, access: "user", nav: "account" },
  { path: "/account", view: accountView, access: "user", nav: "account" },
  { path: "/admin", view: adminView, access: "admin", nav: "admin" },
  { path: "/signin", view: signinView, access: "guest", nav: "account" },
  { path: "/signup", view: signupView, access: "guest", nav: "account" },
];

const main = document.getElementById("app");
let cleanup = null;
let firstRender = true;

function messagePage(heading, text) {
  return { title: heading, render: ({ root }) => root.append(
    el("h1", { tabindex: "-1", text: heading }), el("p", { text }), el("a", { class: "button", href: "#/", text: "Go to the shop" })) };
}
const notFound = messagePage("Page not found", "The page you were looking for doesn't exist.");
const forbidden = messagePage("Admins only", "You're signed in with a customer account, which can't open this page.");

const router = createRouter({
  routes,
  getUser: () => store.get().user,
  onRender(result, current) {
    if (typeof cleanup === "function") cleanup();
    cleanup = null;
    const view = result.type === "render" ? result.route.view : result.type === "forbidden" ? forbidden : notFound;
    main.replaceChildren();
    document.title = `${view.title} | Shopfront`;
    cleanup = view.render({
      root: main, params: result.params ?? {}, query: current.query,
      store, services, actions, select, router, toast,
    });
    updateNav(result.route?.nav);
    window.scrollTo(0, 0);
    // On page changes (not the first load), move focus to the new heading so keyboard and
    // screen reader users start at the top of the new content, like a normal page load.
    if (!firstRender) (main.querySelector("h1") ?? main).focus({ preventScroll: true });
    firstRender = false;
  },
});

/* ---------- header ---------- */
function updateNav(active) {
  const { user, cart } = store.get();
  document.querySelectorAll("[data-show]").forEach((item) => {
    const rule = item.dataset.show;
    item.hidden = !((rule === "guest" && !user) || (rule === "user" && user) || (rule === "admin" && user?.role === "admin"));
  });
  document.querySelectorAll("[data-nav]").forEach((link) => {
    if (link.dataset.nav === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const count = cartCount(cart);
  document.getElementById("cart-count").textContent = String(count);
  document.getElementById("cart-count-label").textContent = count === 1 ? " item" : " items";
}

store.subscribe((s, p) => {
  if (s.user !== p.user) {
    router.refresh(); // the current page may now need a redirect (e.g. signed out on /account)
  } else if (s.cart !== p.cart) {
    updateNav(router.current && routes.find((r) => r.path === router.current.path)?.nav);
  }
});

// Keep tabs in sync: sign-in, sign-out, cart and catalog changes made in another tab
window.addEventListener("storage", (event) => {
  if (!event.key?.startsWith("shopfront:")) return;
  const user = auth.currentUser();
  store.set({
    user: user?.id === store.get().user?.id ? store.get().user : user,
    cart: sanitizeCart(storage.get(cartKey(user), [])),
    overlay: catalogService.getOverlay(),
  });
  bumpOrders();
});

document.querySelector("[data-reset-demo]").addEventListener("click", () => {
  storage.clearAll();
  location.hash = "#/";
  location.reload();
});

/* ---------- start ---------- */
router.start();
actions.loadCatalog();
