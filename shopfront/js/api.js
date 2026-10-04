/**
 * api.js
 * REST client for FakeStoreAPI (https://fakestoreapi.com).
 *
 * - async/await fetch with a timeout (AbortController)
 * - automatic retries with exponential backoff for network errors, timeouts and 5xx
 * - typed errors (ApiError.kind) so the UI can show a helpful message
 * - localStorage response cache: fresh cache skips the network; if the network
 *   fails, stale cache is returned with a warning instead of an empty page
 *
 * fetch and storage are injectable, so the module can be unit tested in Node.
 */

export const API_BASE = "https://fakestoreapi.com";
const CACHE_PREFIX = "shopfront:cache:";
const DEFAULT_MAX_AGE = 10 * 60 * 1000; // 10 minutes

export class ApiError extends Error {
  /**
   * @param {"offline"|"timeout"|"http"|"parse"|"network"} kind
   * @param {string} message
   * @param {number} [status] HTTP status code, for kind "http"
   */
  constructor(kind, message, status) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }

  get retryable() {
    return this.kind === "timeout" || this.kind === "network" || (this.kind === "http" && this.status >= 500);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Low-level GET request with timeout and retries.
 * @returns {Promise<any>} parsed JSON
 */
export async function request(path, {
  fetchImpl = globalThis.fetch,
  timeout = 8000,
  retries = 2,
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
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
      } catch (err) {
        throw err.name === "AbortError"
          ? new ApiError("timeout", `The server took longer than ${timeout / 1000} seconds to respond.`)
          : new ApiError("network", "Could not reach the server.");
      }

      if (!response.ok) {
        throw new ApiError("http", `The server responded with ${response.status}.`, response.status);
      }

      try {
        return await response.json();
      } catch {
        throw new ApiError("parse", "The server sent data we could not read.");
      }
    } catch (err) {
      const canRetry = err instanceof ApiError && err.retryable && attempt < retries;
      if (!canRetry) throw err;
      await sleep(backoff * 2 ** attempt); // 400ms, 800ms, ...
    } finally {
      clearTimeout(timer);
    }
  }
}

/* ---------- cache ---------- */

function readCache(storage, key) {
  try {
    const entry = JSON.parse(storage.getItem(CACHE_PREFIX + key));
    return entry && Array.isArray(entry.data) && Number.isFinite(entry.savedAt) ? entry : null;
  } catch {
    return null;
  }
}

function writeCache(storage, key, data, now) {
  try {
    storage.setItem(CACHE_PREFIX + key, JSON.stringify({ savedAt: now, data }));
  } catch {
    /* storage full or blocked: the app still works without the cache */
  }
}

export function clearCache(storage = globalThis.localStorage) {
  try {
    Object.keys(storage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => storage.removeItem(k));
  } catch { /* ignore */ }
}

/**
 * GET with cache.
 * @returns {Promise<{data: any[], source: "network"|"cache"|"stale", savedAt: number, error?: ApiError}>}
 */
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

/* ---------- endpoints ---------- */

const isProductList = (data) =>
  Array.isArray(data) && data.every((p) => p && Number.isInteger(p.id) && typeof p.title === "string" && Number.isFinite(p.price));

const isStringList = (data) => Array.isArray(data) && data.every((c) => typeof c === "string");

/** GET /products */
export const getProducts = (options) => cachedGet("/products", "products", { validate: isProductList, ...options });

/** GET /products/categories */
export const getCategories = (options) => cachedGet("/products/categories", "categories", { validate: isStringList, ...options });

/** Turns any error into a short title + message for the error banner. */
export function describeError(error) {
  if (!(error instanceof ApiError)) {
    return { title: "Something went wrong", message: "Try again. If it keeps happening, reload the page." };
  }
  switch (error.kind) {
    case "offline":
      return { title: "You're offline", message: "Check your internet connection, then try again." };
    case "timeout":
      return { title: "The store is taking too long", message: "The product server is slow right now. Try again in a moment." };
    case "http":
      return error.status >= 500
        ? { title: "The store is having problems", message: `The product server returned an error (${error.status}). Try again in a minute.` }
        : { title: "Products couldn't be loaded", message: `The request was rejected (${error.status}). Reload the page to try again.` };
    case "parse":
      return { title: "Unexpected data from the store", message: "The product server sent something we couldn't read. Try again later." };
    default:
      return { title: "Couldn't reach the store", message: "Check your connection, then try again." };
  }
}
