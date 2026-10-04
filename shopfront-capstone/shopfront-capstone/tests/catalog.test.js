import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalogService, mergeCatalog, validateProduct, LOCAL_ID_START } from "../js/services/catalog.js";
import { products, memoryStorage } from "./helpers.js";

function setup() {
  const calls = [];
  const remote = {
    createProduct: async (p) => calls.push(["POST", p]),
    updateProduct: async (id, p) => calls.push(["PUT", id, p]),
    deleteProduct: async (id) => calls.push(["DELETE", id]),
  };
  return { calls, catalog: createCatalogService({ storage: memoryStorage(), remote }) };
}
const valid = { title: "Depot Hoodie", price: "24.50", category: "Men's clothing", description: "Warm.", image: "" };

test("validation catches every bad field", () => {
  const { errors } = validateProduct({ title: "ab", price: "-1", category: "", description: "x".repeat(1001), image: "http://insecure" });
  assert.deepEqual(Object.keys(errors).sort(), ["category", "description", "image", "price", "title"]);
  assert.ok(validateProduct({ ...valid, price: "1.999" }).errors.price);
  assert.deepEqual(validateProduct(valid).errors, {});
});

test("create adds a local product with a new id and calls POST", () => {
  const { catalog, calls } = setup();
  const { product, overlay } = catalog.create(valid);
  assert.equal(product.id, LOCAL_ID_START);
  assert.equal(product.price, 24.5);
  assert.equal(product.category, "men's clothing");
  const merged = mergeCatalog(products, overlay);
  assert.equal(merged.length, 21);
  assert.equal(calls[0][0], "POST");
  assert.equal(catalog.create(valid).product.id, LOCAL_ID_START + 1);
});

test("update changes an API product without touching the original data", () => {
  const { catalog, calls } = setup();
  const { overlay } = catalog.update(1, { ...valid, title: "Renamed backpack", price: 99 });
  const merged = mergeCatalog(products, overlay);
  assert.equal(merged.find((p) => p.id === 1).title, "Renamed backpack");
  assert.equal(products[0].title.startsWith("Fjallraven"), true);
  assert.deepEqual(calls[0].slice(0, 2), ["PUT", 1]);
});

test("delete hides API products and removes local ones", () => {
  const { catalog } = setup();
  const { product } = catalog.create(valid);
  catalog.remove(product.id);
  const { overlay } = catalog.remove(2);
  const merged = mergeCatalog(products, overlay);
  assert.equal(merged.length, 19);
  assert.ok(!merged.some((p) => p.id === 2 || p.id === product.id));
});

test("invalid input returns errors and changes nothing", () => {
  const { catalog } = setup();
  assert.ok(catalog.create({ title: "" }).errors.title);
  assert.equal(catalog.getOverlay().created.length, 0);
});

test("reset restores the original catalog", () => {
  const { catalog } = setup();
  catalog.remove(1);
  assert.equal(mergeCatalog(products, catalog.reset().overlay).length, 20);
});
