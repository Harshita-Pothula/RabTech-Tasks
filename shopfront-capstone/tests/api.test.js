import { test } from "node:test";
import assert from "node:assert/strict";
import { getProducts, request, createProduct, updateProduct, deleteProduct, API_BASE } from "../js/api.js";
import { products, memoryBacking, fakeFetch } from "./helpers.js";

const fast = { backoff: 1, isOnline: () => true };

test("GET /products is cached", async () => {
  const storage = memoryBacking();
  const fetchImpl = fakeFetch({ body: products });
  assert.equal((await getProducts({ fetchImpl, storage, ...fast })).source, "network");
  assert.equal((await getProducts({ fetchImpl, storage, ...fast })).source, "cache");
  assert.equal(fetchImpl.calls.length, 1);
});

test("write methods use the right verb, URL and JSON body", async () => {
  const fetchImpl = fakeFetch({ body: { id: 21 } });
  await createProduct({ title: "X" }, { fetchImpl, ...fast });
  await updateProduct(7, { title: "Y" }, { fetchImpl, ...fast });
  await deleteProduct(7, { fetchImpl, ...fast });
  assert.deepEqual(fetchImpl.calls.map((c) => [c.method, c.url.replace(API_BASE, "")]),
    [["POST", "/products"], ["PUT", "/products/7"], ["DELETE", "/products/7"]]);
  assert.equal(JSON.parse(fetchImpl.calls[0].body).title, "X");
});

test("writes are never retried, reads are", async () => {
  const failing = fakeFetch({ status: 503, body: {} });
  await assert.rejects(createProduct({}, { fetchImpl: failing, ...fast }));
  assert.equal(failing.calls.length, 1);
  const flaky = fakeFetch({ status: 503, body: {} }, { body: products });
  assert.equal((await request("/products", { fetchImpl: flaky, ...fast })).length, 20);
});

test("stale cache is used when the network fails", async () => {
  const storage = memoryBacking();
  let t = 0;
  await getProducts({ fetchImpl: fakeFetch({ body: products }), storage, now: () => t, ...fast });
  t = 3600_000;
  const result = await getProducts({ fetchImpl: fakeFetch(new TypeError("down")), storage, now: () => t, ...fast, retries: 0 });
  assert.equal(result.source, "stale");
});
