import { test } from "node:test";
import assert from "node:assert/strict";
import { request, getProducts, getCategories, ApiError, describeError, API_BASE } from "../js/api.js";
import { products, categories, memoryStorage, fakeFetch } from "./helpers.js";

const fast = { backoff: 1, isOnline: () => true };

test("getProducts calls GET /products and caches the result", async () => {
  const storage = memoryStorage();
  const fetchImpl = fakeFetch({ body: products });
  const first = await getProducts({ fetchImpl, storage, ...fast });
  assert.equal(first.source, "network");
  assert.equal(first.data.length, 20);
  assert.equal(fetchImpl.calls[0], `${API_BASE}/products`);

  const second = await getProducts({ fetchImpl, storage, ...fast });
  assert.equal(second.source, "cache");
  assert.equal(fetchImpl.calls.length, 1, "fresh cache should skip the network");
});

test("getCategories calls GET /products/categories", async () => {
  const fetchImpl = fakeFetch({ body: categories });
  const result = await getCategories({ fetchImpl, storage: memoryStorage(), ...fast });
  assert.deepEqual(result.data, categories);
  assert.equal(fetchImpl.calls[0], `${API_BASE}/products/categories`);
});

test("expired cache is refreshed from the network", async () => {
  const storage = memoryStorage();
  let clock = 0;
  const now = () => clock;
  await getProducts({ fetchImpl: fakeFetch({ body: products }), storage, now, ...fast });
  clock = 11 * 60 * 1000;
  const fetchImpl = fakeFetch({ body: products });
  const result = await getProducts({ fetchImpl, storage, now, ...fast });
  assert.equal(result.source, "network");
  assert.equal(fetchImpl.calls.length, 1);
});

test("5xx errors are retried, then succeed", async () => {
  const fetchImpl = fakeFetch({ status: 503, body: {} }, { status: 502, body: {} }, { body: products });
  const data = await request("/products", { fetchImpl, retries: 2, ...fast });
  assert.equal(data.length, 20);
  assert.equal(fetchImpl.calls.length, 3);
});

test("4xx errors are not retried", async () => {
  const fetchImpl = fakeFetch({ status: 404, body: {} });
  await assert.rejects(request("/nope", { fetchImpl, retries: 2, ...fast }), (err) => err.kind === "http" && err.status === 404);
  assert.equal(fetchImpl.calls.length, 1);
});

test("slow responses time out", async () => {
  const hang = (url, init) => new Promise((_, reject) =>
    init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))));
  await assert.rejects(request("/products", { fetchImpl: hang, timeout: 20, retries: 0, ...fast }), (err) => err.kind === "timeout");
});

test("network failure with a cache returns stale data instead of failing", async () => {
  const storage = memoryStorage();
  let clock = 0;
  await getProducts({ fetchImpl: fakeFetch({ body: products }), storage, now: () => clock, ...fast });
  clock = 60 * 60 * 1000;
  const result = await getProducts({ fetchImpl: fakeFetch(new TypeError("Failed to fetch")), storage, now: () => clock, retries: 0, ...fast });
  assert.equal(result.source, "stale");
  assert.equal(result.error.kind, "network");
  assert.equal(result.data.length, 20);
});

test("offline with no cache throws an offline error", async () => {
  await assert.rejects(
    getProducts({ fetchImpl: fakeFetch({ body: products }), storage: memoryStorage(), isOnline: () => false }),
    (err) => err instanceof ApiError && err.kind === "offline");
});

test("unexpected data shape is rejected", async () => {
  await assert.rejects(
    getProducts({ fetchImpl: fakeFetch({ body: { not: "a list" } }), storage: memoryStorage(), ...fast }),
    (err) => err.kind === "parse");
});

test("every error kind has a friendly message", () => {
  for (const err of [new ApiError("offline", ""), new ApiError("timeout", ""), new ApiError("http", "", 503),
                     new ApiError("http", "", 404), new ApiError("parse", ""), new ApiError("network", ""), new Error("x")]) {
    const { title, message } = describeError(err);
    assert.ok(title.length > 5 && message.length > 10);
  }
});
