/**
 * state.js
 * A tiny observable store, plus persistence to localStorage and the URL.
 *
 * Persisted on this device (localStorage):
 *   shopfront:cart   cart items
 *   shopfront:prefs  { category, sort } (the user's last view)
 * Kept in the URL (?q=&category=&sort=) so a filtered view can be shared or bookmarked.
 */
import { sanitizeCart } from "./cart.js";
import { SORT_OPTIONS } from "./filters.js";

const KEYS = { cart: "shopfront:cart", prefs: "shopfront:prefs" };

export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();
  return {
    get: () => state,
    /** Merge a partial update (or a function of the old state) and notify listeners. */
    set(update) {
      const patch = typeof update === "function" ? update(state) : update;
      const previous = state;
      state = { ...state, ...patch };
      listeners.forEach((listener) => listener(state, previous));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/* ---------- safe localStorage helpers ---------- */

export function loadJSON(key, fallback, storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback; // blocked storage or corrupted JSON
  }
}

export function saveJSON(key, value, storage = globalThis.localStorage) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // private mode or quota exceeded: the app keeps working in memory
  }
}

export const loadCart = (storage) => sanitizeCart(loadJSON(KEYS.cart, [], storage));
export const saveCart = (cart, storage) => saveJSON(KEYS.cart, cart, storage);

export function loadPrefs(storage) {
  const prefs = loadJSON(KEYS.prefs, {}, storage) || {};
  return {
    category: typeof prefs.category === "string" ? prefs.category : "all",
    sort: prefs.sort in SORT_OPTIONS ? prefs.sort : "featured",
  };
}
export const savePrefs = ({ category, sort }, storage) => saveJSON(KEYS.prefs, { category, sort }, storage);

export function resetSavedData(storage = globalThis.localStorage) {
  try { Object.values(KEYS).forEach((key) => storage.removeItem(key)); } catch { /* ignore */ }
}

/** Listen for cart changes made in another tab of the same site. */
export function onCartChangedElsewhere(callback) {
  window.addEventListener("storage", (event) => {
    if (event.key === KEYS.cart) callback(loadCart());
  });
}

/* ---------- URL <-> view state ---------- */

export function readViewFromURL(search = location.search) {
  const params = new URLSearchParams(search);
  const view = {};
  if (params.has("q")) view.query = params.get("q");
  if (params.has("category")) view.category = params.get("category");
  if (params.get("sort") in SORT_OPTIONS) view.sort = params.get("sort");
  return view;
}

/** Updates the address bar without reloading the page or adding history entries. */
export function writeViewToURL({ query, category, sort }) {
  const params = new URLSearchParams(location.search);
  query ? params.set("q", query) : params.delete("q");
  category && category !== "all" ? params.set("category", category) : params.delete("category");
  sort && sort !== "featured" ? params.set("sort", sort) : params.delete("sort");
  const qs = params.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
}
