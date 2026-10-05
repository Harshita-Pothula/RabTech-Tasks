import { test } from "node:test";
import assert from "node:assert/strict";
import { addItem, setQuantity, removeItem, cartCount, cartTotal, quantityOf, sanitizeCart, MAX_QUANTITY } from "../js/lib/cart.js";
import { products } from "./helpers.js";

const [backpack, tshirt] = products;

test("adding the same product twice increases quantity", () => {
  let cart = addItem([], backpack);
  cart = addItem(cart, backpack);
  assert.equal(cart.length, 1);
  assert.equal(quantityOf(cart, backpack.id), 2);
});

test("cart functions never mutate the previous cart", () => {
  const before = addItem([], backpack);
  const frozen = Object.freeze(before.map(Object.freeze));
  const after = addItem(frozen, tshirt);
  assert.equal(frozen.length, 1);
  assert.equal(after.length, 2);
});

test("quantity 0 or below removes the item; quantity is capped", () => {
  const cart = addItem([], backpack);
  assert.equal(setQuantity(cart, backpack.id, 0).length, 0);
  assert.equal(quantityOf(setQuantity(cart, backpack.id, 500), backpack.id), MAX_QUANTITY);
});

test("count and total are correct without floating point errors", () => {
  let cart = addItem([], { id: 101, title: "A", price: 0.1, image: "" });
  cart = addItem(cart, { id: 102, title: "B", price: 0.2, image: "" });
  assert.equal(cartTotal(cart), 0.3);
  cart = setQuantity(addItem(cart, tshirt), tshirt.id, 3);
  assert.equal(cartCount(cart), 5);
  assert.equal(cartTotal(cart), 67.2);
  assert.equal(removeItem(cart, tshirt.id).length, 2);
});

test("sanitizeCart drops corrupted localStorage data", () => {
  assert.deepEqual(sanitizeCart("not an array"), []);
  const cleaned = sanitizeCart([
    { id: 1, title: "OK", price: 5, image: "", quantity: 2 },
    { id: "2", title: "bad id", price: 5, quantity: 1 },
    { id: 3, title: "bad qty", price: 5, quantity: -1 },
    null,
  ]);
  assert.deepEqual(cleaned.map((i) => i.id), [1]);
});
