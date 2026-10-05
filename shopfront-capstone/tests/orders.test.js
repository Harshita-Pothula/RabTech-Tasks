import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrderService, OrderError, canCancel, canDelete } from "../js/services/orders.js";
import { addItem } from "../js/lib/cart.js";
import { products, memoryStorage, fakeClock } from "./helpers.js";

const ann = { id: "u_ann", name: "Ann", role: "customer" };
const bob = { id: "u_bob", name: "Bob", role: "customer" };
const admin = { id: "u_admin", name: "Admin", role: "admin" };
const delivery = { name: "Ann", phone: "9876543210", address: "1 Road", city: "Hyderabad", pin: "500001", shipping: "express", payment: "cod" };
let n = 0;
const setup = () => createOrderService({ storage: memoryStorage(), now: fakeClock(), makeId: () => `T${++n}` });
const cart = addItem(addItem([], products[1]), products[1]); // 2 x $22.30

test("placing an order snapshots the cart and adds shipping", () => {
  const orders = setup();
  const order = orders.place(ann, cart, delivery);
  assert.equal(order.status, "placed");
  assert.equal(order.subtotal, 44.6);
  assert.equal(order.total, 54.59);
  assert.equal(orders.listFor(ann).length, 1);
});

test("empty cart or signed-out user can't order", () => {
  const orders = setup();
  assert.throws(() => orders.place(ann, [], delivery), OrderError);
  assert.throws(() => orders.place(null, cart, delivery), OrderError);
});

test("customers only see and change their own orders", () => {
  const orders = setup();
  const order = orders.place(ann, cart, delivery);
  assert.equal(orders.listFor(bob).length, 0);
  assert.throws(() => orders.cancel(bob, order.id), /not found/);
});

test("full lifecycle: cancel only before shipping, delete only when finished", () => {
  const orders = setup();
  const a = orders.place(ann, cart, delivery);
  assert.throws(() => orders.remove(ann, a.id), OrderError);
  assert.equal(orders.cancel(ann, a.id).status, "cancelled");
  orders.remove(ann, a.id);
  assert.equal(orders.listFor(ann).length, 0);

  const b = orders.place(ann, cart, delivery);
  assert.throws(() => orders.advance(ann, b.id), /Only admins/);
  assert.equal(orders.advance(admin, b.id).status, "shipped");
  assert.throws(() => orders.cancel(ann, b.id), /haven't shipped/);
  assert.equal(orders.advance(admin, b.id).status, "delivered");
  assert.throws(() => orders.advance(admin, b.id), OrderError);
  assert.ok(canDelete(orders.get(ann, b.id)) && !canCancel(orders.get(ann, b.id)));
});
