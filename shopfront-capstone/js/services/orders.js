/**
 * orders.js
 * Order lifecycle: placed -> shipped -> delivered, or placed -> cancelled.
 * Customers can place, view, cancel (while "placed") and delete finished orders.
 * Admins can move orders forward (placed -> shipped -> delivered).
 */
import { cartTotal } from "../lib/cart.js";

export const SHIPPING = {
  standard: { label: "Standard delivery, 3 to 5 days", price: 0 },
  express: { label: "Express delivery, 1 to 2 days", price: 9.99 },
};
export const PAYMENT = {
  cod: "Cash on delivery",
  upi: "UPI on delivery",
};
export const STATUS_LABELS = { placed: "Placed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };
const NEXT_STATUS = { placed: "shipped", shipped: "delivered" };

export class OrderError extends Error {
  constructor(message) { super(message); this.name = "OrderError"; }
}

export const nextStatus = (status) => NEXT_STATUS[status] ?? null;
export const canCancel = (order) => order.status === "placed";
export const canDelete = (order) => order.status === "cancelled" || order.status === "delivered";

export function createOrderService({ storage, now = Date.now, makeId }) {
  const all = () => storage.get("orders", []);
  const save = (orders) => storage.set("orders", orders);
  const newId = makeId ?? (() => `SF-${now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1296).toString(36).toUpperCase().padStart(2, "0")}`);

  function mine(user, id) {
    const order = all().find((o) => o.id === id);
    if (!order || order.userId !== user.id) throw new OrderError("Order not found.");
    return order;
  }

  function replace(order) {
    save(all().map((o) => (o.id === order.id ? order : o)));
    return order;
  }

  return {
    listAll: () => [...all()].sort((a, b) => b.createdAt - a.createdAt),
    listFor: (user) => all().filter((o) => o.userId === user.id).sort((a, b) => b.createdAt - a.createdAt),
    get: (user, id) => mine(user, id),

    place(user, cart, { name, phone, address, city, pin, shipping = "standard", payment = "cod" }) {
      if (!user) throw new OrderError("Sign in to place an order.");
      if (!cart.length) throw new OrderError("Your cart is empty.");
      if (!(shipping in SHIPPING) || !(payment in PAYMENT)) throw new OrderError("Choose delivery and payment options.");
      const subtotal = cartTotal(cart);
      const shippingCost = SHIPPING[shipping].price;
      const order = {
        id: newId(),
        userId: user.id,
        customer: user.name,
        createdAt: now(),
        status: "placed",
        items: cart.map(({ id, title, price, image, quantity }) => ({ id, title, price, image, quantity })),
        subtotal,
        shippingCost,
        total: Math.round((subtotal + shippingCost) * 100) / 100,
        delivery: { name, phone, address, city, pin, shipping, payment },
      };
      save([...all(), order]);
      return order;
    },

    cancel(user, id) {
      const order = mine(user, id);
      if (!canCancel(order)) throw new OrderError("Only orders that haven't shipped can be cancelled.");
      return replace({ ...order, status: "cancelled", updatedAt: now() });
    },

    remove(user, id) {
      const order = mine(user, id);
      if (!canDelete(order)) throw new OrderError("Only cancelled or delivered orders can be removed.");
      save(all().filter((o) => o.id !== id));
    },

    /** Admin only: move an order to its next stage. */
    advance(admin, id) {
      if (admin?.role !== "admin") throw new OrderError("Only admins can update order status.");
      const order = all().find((o) => o.id === id);
      if (!order) throw new OrderError("Order not found.");
      const next = nextStatus(order.status);
      if (!next) throw new OrderError(`A ${order.status} order can't move forward.`);
      return replace({ ...order, status: next, updatedAt: now() });
    },
  };
}
