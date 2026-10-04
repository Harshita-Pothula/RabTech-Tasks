import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHash, buildHash, matchRoute, resolveRoute } from "../js/router.js";

const routes = [
  { path: "/", name: "catalog" },
  { path: "/product/:id", name: "product" },
  { path: "/checkout", name: "checkout", access: "user" },
  { path: "/admin", name: "admin", access: "admin" },
  { path: "/signin", name: "signin", access: "guest" },
];
const customer = { role: "customer" };
const admin = { role: "admin" };

test("parse and build hashes", () => {
  assert.deepEqual(parseHash("#/product/3?x=1"), { path: "/product/3", query: { x: "1" } });
  assert.deepEqual(parseHash(""), { path: "/", query: {} });
  assert.equal(buildHash("/", { q: "ssd", empty: "" }), "#/?q=ssd");
});

test("match routes with parameters", () => {
  assert.deepEqual(matchRoute(routes, "/product/42").params, { id: "42" });
  assert.equal(matchRoute(routes, "/nope"), null);
});

test("signed-out users are sent to sign in, then back", () => {
  const r = resolveRoute(routes, { path: "/checkout", query: {} }, null);
  assert.equal(r.type, "redirect");
  assert.equal(parseHash(r.to).query.next, "#/checkout");
});

test("customers can't open admin pages", () => {
  assert.equal(resolveRoute(routes, { path: "/admin", query: {} }, customer).type, "forbidden");
  assert.equal(resolveRoute(routes, { path: "/admin", query: {} }, admin).type, "render");
});

test("signed-in users skip sign in, and unsafe 'next' values are ignored", () => {
  assert.equal(resolveRoute(routes, { path: "/signin", query: { next: "#/checkout" } }, customer).to, "#/checkout");
  assert.equal(resolveRoute(routes, { path: "/signin", query: { next: "https://evil.example" } }, customer).to, "#/");
});

test("unknown pages are not found", () => {
  assert.equal(resolveRoute(routes, { path: "/missing", query: {} }, null).type, "notfound");
});
