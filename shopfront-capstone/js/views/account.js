/** Account: profile and order history (read, cancel, remove). */
import { el, formatPrice, timeEl, statusBadge } from "../lib/dom.js";
import { STATUS_LABELS } from "../services/orders.js";
import { pageHeading } from "./shared.js";

export const title = "Your account";

export function render(ctx) {
  const { root, store, services, actions } = ctx;

  function draw() {
    const { user } = store.get();
    const orders = services.orders.listFor(user);
    root.replaceChildren(
      pageHeading(`Hello, ${user.name.split(" ")[0]}`),
      el("div", { class: "account-layout" },
        el("section", { class: "panel", "aria-labelledby": "profile-title" },
          el("h2", { id: "profile-title", text: "Profile" }),
          el("dl", { class: "profile" },
            el("div", {}, el("dt", { text: "Name" }), el("dd", { text: user.name })),
            el("div", {}, el("dt", { text: "Email" }), el("dd", { text: user.email })),
            el("div", {}, el("dt", { text: "Account type" }), el("dd", { text: user.role === "admin" ? "Admin" : "Customer" })),
            el("div", {}, el("dt", { text: "Member since" }), el("dd", {}, timeEl(user.createdAt)))),
          el("button", { class: "button button--quiet", type: "button", "data-signout": true, text: "Sign out" })),
        el("section", { "aria-labelledby": "orders-title" },
          el("h2", { id: "orders-title", text: `Your orders (${orders.length})` }),
          orders.length
            ? el("ul", { class: "order-list" }, orders.map((o) => el("li", { class: "order-card" },
                el("div", { class: "order-card__main" },
                  el("a", { class: "order-card__id", href: `#/orders/${o.id}` }, `Order ${o.id}`),
                  el("p", {}, "Placed ", timeEl(o.createdAt), `. ${o.items.reduce((n, i) => n + i.quantity, 0)} items.`)),
                statusBadge(o.status, STATUS_LABELS[o.status]),
                el("p", { class: "order-card__total", text: formatPrice(o.total) }))))
            : el("div", { class: "empty-state" },
                el("p", { class: "empty-state__title", text: "No orders yet." }),
                el("a", { class: "button", href: "#/", text: "Start shopping" })))));
    root.querySelector("[data-signout]").addEventListener("click", () => actions.signOut());
  }

  draw();
  return store.subscribe((s, p) => { if (s.ordersVersion !== p.ordersVersion) draw(); });
}
