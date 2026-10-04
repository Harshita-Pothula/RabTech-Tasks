import { test } from "node:test";
import assert from "node:assert/strict";
import { filterProducts, sortProducts, applyView, countByCategory, normalize } from "../js/lib/filters.js";
import { products } from "./helpers.js";

test("search matches title, case-insensitive", () => {
  const result = filterProducts(products, { query: "ssd" });
  assert.deepEqual(result.map((p) => p.id), [10, 11]);
});

test("every word in the query must match", () => {
  assert.equal(filterProducts(products, { query: "women jacket" }).length, 3);
});

test("search ignores accents and extra spaces", () => {
  assert.equal(normalize("  Café  "), "cafe");
  assert.equal(filterProducts(products, { query: "   " }).length, products.length);
});

test("category filter combines with search", () => {
  const result = filterProducts(products, { query: "gold", category: "jewelery" });
  assert.ok(result.length >= 2);
  assert.ok(result.every((p) => p.category === "jewelery"));
});

test("sorting by price works both ways and does not mutate the input", () => {
  const original = products.map((p) => p.id);
  const asc = sortProducts(products, "price-asc").map((p) => p.price);
  assert.deepEqual(asc, [...asc].sort((a, b) => a - b));
  assert.equal(sortProducts(products, "price-desc")[0].price, 999.99);
  assert.deepEqual(products.map((p) => p.id), original);
});

test("top rated breaks ties by number of reviews", () => {
  const [first, second] = sortProducts(products, "rating");
  assert.equal(first.rating.rate, 4.8);
  assert.ok(first.rating.count >= second.rating.count);
});

test("featured keeps API order; unknown sort key does too", () => {
  assert.deepEqual(sortProducts(products, "featured"), products);
  assert.deepEqual(sortProducts(products, "nonsense"), products);
});

test("applyView filters then sorts", () => {
  const view = applyView(products, { query: "", category: "electronics", sort: "price-asc" });
  assert.equal(view.length, 6);
  assert.equal(view[0].price, 64);
});

test("countByCategory includes an 'all' total", () => {
  assert.deepEqual(countByCategory(products), {
    all: 20, "men's clothing": 4, jewelery: 4, electronics: 6, "women's clothing": 6,
  });
});
