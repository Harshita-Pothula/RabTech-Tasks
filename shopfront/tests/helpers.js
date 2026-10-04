import { readFileSync } from "node:fs";

export const products = JSON.parse(readFileSync(new URL("./fixtures/products.json", import.meta.url)));
export const categories = JSON.parse(readFileSync(new URL("./fixtures/categories.json", import.meta.url)));

/** In-memory replacement for localStorage */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    get size() { return data.size; },
  };
}

/** Fake fetch that plays back a list of responses in order */
export function fakeFetch(...responses) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push(url);
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (typeof next === "function") return next(url, init);
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 });
  };
  fn.calls = calls;
  return fn;
}
