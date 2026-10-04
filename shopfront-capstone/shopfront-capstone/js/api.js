/**
 * api.js
 * REST client for FakeStoreAPI (https://fakestoreapi.com).
 *
 * Reads (GET) use a timeout, retries with exponential backoff, and a
 * localStorage cache with a stale-data fallback. Writes (POST/PUT/DELETE)
 * are sent once, without retries, because repeating a POST could duplicate it.
 *
 * Note: FakeStoreAPI accepts writes and returns a realistic response, but it
 * does not store them. The catalog service therefore also saves every change
 * locally, which is what the app displays.
 */
export const API_BASE = "https://fakestoreapi.com";
const CACHE_PREFIX = "shopfront:cache:";
const DEFAULT_MAX_AGE = 10 * 60 * 1000;

export class ApiError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = "ApiError";
    this.kind = kind; // offline | timeout | http | parse | network
    this.status = status;
  }
  get retryable() {
    return this.kind === "timeout" || this.kind === "network" || (this.kind === "http" && this.status >= 500);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function request(path, {
  method = "GET",
  body,
  fetchImpl = globalThis.fetch,
  timeout = 8000,
  retries = method === "GET" ? 2 : 0,
  backoff = 400,
  isOnline = () => globalThis.navigator?.onLine ?? true,
} = {}) {
  for (let attempt = 0; ; attempt++) {
    if (!isOnline()) throw new ApiError("offline", "You appear to be offline.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      let response;
      try {
        response = await fetchImpl(`${API_BASE}${path}`, {
          method,
          signal: controller.signal,
          headers: body === undefined
            ? { Accept: "application/json" }
            : { Accept: "application/json", "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (err) {
        throw err.name === "AbortError"
          ? new ApiError("timeout", `No response after ${timeout / 1000} seconds.`)
          : new ApiError("network", "Could not reach the server.");
      }
      if (!response.ok) throw new ApiError("http", `The server responded with ${response.status}.`, response.status);
      try {
        const text = await response.text();
        return text ? JSON.parse(text) : null;
      } catch {
        throw new ApiError("parse", "The server sent data we could not read.");
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.retryable && attempt < retries)) throw err;
      await sleep(backoff * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ---------- cached reads ---------- */

function readCache(storage, key) {
  try {
    const entry = JSON.parse(storage.getItem(CACHE_PREFIX + key));
    return entry && Array.isArray(entry.data) && Number.isFinite(entry.savedAt) ? entry : null;
  } catch {
    return null;
  }
}

function writeCache(storage, key, data, savedAt) {
  try { storage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt, data })); } catch { /* ignore */ }
}

export async function cachedGet(path, key, {
  storage = globalThis.localStorage,
  maxAge = DEFAULT_MAX_AGE,
  now = Date.now,
  forceRefresh = false,
  validate = Array.isArray,
  ...requestOptions
} = {}) {
  const cached = readCache(storage, key);
  if (cached && !forceRefresh && now() - cached.savedAt < maxAge) {
    return { data: cached.data, source: "cache", savedAt: cached.savedAt };
  }
  try {
    const data = await request(path, requestOptions);
    if (!validate(data)) throw new ApiError("parse", "The server sent data in an unexpected format.");
    const savedAt = now();
    writeCache(storage, key, data, savedAt);
    return { data, source: "network", savedAt };
  } catch (error) {
    if (cached) return { data: cached.data, source: "stale", savedAt: cached.savedAt, error };
    throw error;
  }
}

const isProductList = (d) => Array.isArray(d) && d.every((p) => p && Number.isInteger(p.id) && typeof p.title === "string" && Number.isFinite(p.price));
const isStringList = (d) => Array.isArray(d) && d.every((c) => typeof c === "string");

/* ---------- endpoints ---------- */

/** GET /products */
export const getProducts = (o) => cachedGet("/products", "products", { validate: isProductList, ...o });
/** GET /products/categories */
export const getCategories = (o) => cachedGet("/products/categories", "categories", { validate: isStringList, ...o });
/** POST /products */
export const createProduct = (product, o) => request("/products", { method: "POST", body: product, ...o });
/** PUT /products/:id */
export const updateProduct = (id, product, o) => request(`/products/${id}`, { method: "PUT", body: product, ...o });
/** DELETE /products/:id */
export const deleteProduct = (id, o) => request(`/products/${id}`, { method: "DELETE", ...o });

export function describeError(error) {
  if (!(error instanceof ApiError)) return { title: "Something went wrong", message: "Try again. If it keeps happening, reload the page." };
  switch (error.kind) {
    case "offline": return { title: "You're offline", message: "Check your internet connection, then try again." };
    case "timeout": return { title: "The store is taking too long", message: "The product server is slow right now. Try again in a moment." };
    case "http": return error.status >= 500
      ? { title: "The store is having problems", message: `The product server returned an error (${error.status}). Try again in a minute.` }
      : { title: "Products couldn't be loaded", message: `The request was rejected (${error.status}). Reload the page to try again.` };
    case "parse": return { title: "Unexpected data from the store", message: "The product server sent something we couldn't read. Try again later." };
    default: return { title: "Couldn't reach the store", message: "Check your connection, then try again." };
  }
}
