/** One order: confirmation and details, with cancel / remove. */
import { el, formatPrice, timeEl, productImage, statusBadge } from "../lib/dom.js";
import { confirmDialog } from "../lib/dialogs.js";
import { STATUS_LABELS, SHIPPING, PAYMENT, canCancel, canDelete } from "../services/orders.js";

export const title = "Order";

export function render(ctx) {
  const { root, store, params, services, actions, router, toast } = ctx;

  function draw() {
    let order;
    try { order = services.orders.get(store.get().user, params.id); } catch { order = null; }
    if (!order) {
      root.replaceChildren(el("h1", { tabindex: "-1", text: "Order not found" }),
        el("p", { text: "This order doesn't exist or belongs to another account." }),
        el("a", { class: "button", href: "#/account", text: "See your orders" }));
      return;
    }
    document.title = `Order ${order.id} | Shopfront`;
    const justPlaced = order.status === "placed" && Date.now() - order.createdAt < 60_000;
    const d = order.delivery;

    root.replaceChildren(
      el("p", { class: "back-link" }, el("a", { href: "#/account", text: "← All orders" })),
      el("div", { class: "page-head" },
        el("h1", { tabindex: "-1" }, justPlaced ? "Thank you, your order is placed" : `Order ${order.id}`),
        el("p", { class: "page-intro" }, "Order ", el("strong", { text: order.id }), ", placed ", timeEl(order.createdAt, true), ". ",
          statusBadge(order.status, STATUS_LABELS[order.status]))),
      el("div", { class: "order-layout" },
        el("section", { "aria-labelledby": "items-title", class: "panel" },
          el("h2", { id: "items-title", text: "Items" }),
          el("ul", { class: "order-items" }, order.items.map((i) => el("li", {},
            productImage(i, { size: 64 }),
            el("span", { class: "order-items__title", text: i.title }),
            el("span", { text: `${i.quantity} × ${formatPrice(i.price)}` }),
            el("strong", { text: formatPrice(i.price * i.quantity) })))),
          el("dl", { class: "summary__rows" },
            el("div", {}, el("dt", { text: "Subtotal" }), el("dd", { text: formatPrice(order.subtotal) })),
            el("div", {}, el("dt", { text: "Delivery" }), el("dd", { text: order.shippingCost ? formatPrice(order.shippingCost) : "Free" })),
            el("div", { class: "summary__total" }, el("dt", { text: "Total" }), el("dd", { text: formatPrice(order.total) })))),
        el("section", { "aria-labelledby": "delivery-title", class: "panel" },
          el("h2", { id: "delivery-title", text: "Delivery" }),
          el("address", {}, d.name, el("br"), d.address, el("br"), `${d.city} ${d.pin}`, el("br"), `Mobile: ${d.phone}`),
          el("p", { text: SHIPPING[d.shipping]?.label }),
          el("p", { text: `Payment: ${PAYMENT[d.payment]}` }),
          el("div", { class: "order-actions" },
            canCancel(order) ? el("button", { class: "button button--danger", type: "button", "data-cancel": true, text: "Cancel order" }) : null,
            canDelete(order) ? el("button", { class: "button button--quiet", type: "button", "data-delete": true, text: "Remove from history" }) : null))));

    root.querySelector("[data-cancel]")?.addEventListener("click", async () => {
      if (!await confirmDialog({ title: `Cancel order ${order.id}?`, message: "This can't be undone. You can order the same items again from the shop.", confirmLabel: "Cancel order", danger: true })) return;
      actions.cancelOrder(order.id);
      toast(`Order ${order.id} cancelled.`);
      draw();
      root.querySelector("h1").focus();
    });
    root.querySelector("[data-delete]")?.addEventListener("click", async () => {
      if (!await confirmDialog({ title: "Remove this order from your history?", message: "It will no longer appear in your account.", confirmLabel: "Remove", danger: true })) return;
      actions.deleteOrder(order.id);
      toast(`Order ${order.id} removed.`);
      router.navigate("/account");
    });
  }

  draw();
  return store.subscribe((s, p) => { if (s.ordersVersion !== p.ordersVersion) draw(); });
}
