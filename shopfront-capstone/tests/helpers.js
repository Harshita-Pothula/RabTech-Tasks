import { readFileSync } from "node:fs";
import { createStorage } from "../js/lib/storage.js";

export const products = JSON.parse(readFileSync(new URL("./fixtures/products.json", import.meta.url)));
export const categories = JSON.parse(readFileSync(new URL("./fixtures/categories.json", import.meta.url)));

/** In-memory replacement for localStorage (same methods the browser has). */
export function memoryBacking() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  };
}
export const memoryStorage = () => createStorage(memoryBacking());

export function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  };
  fn.calls = calls;
  return fn;
}

/** A clock you can move forward in tests */
export function fakeClock(start = 1_700_000_000_000) {
  let t = start;
  const now = () => t;
  now.advance = (ms) => { t += ms; };
  return now;
}
