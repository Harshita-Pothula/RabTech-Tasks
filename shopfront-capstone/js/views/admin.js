/** Admin dashboard: product CRUD and order status updates. */
import { el, hidden, formatPrice, categoryName, timeEl, statusBadge } from "../lib/dom.js";
import { confirmDialog } from "../lib/dialogs.js";
import { STATUS_LABELS, nextStatus } from "../services/orders.js";
import { openProductForm } from "./productForm.js";
import { pageHeading, catalogBanner } from "./shared.js";

export const title = "Admin";

export function render(ctx) {
  const { root, store, services, actions, select, toast } = ctx;
  const page = el("div", { class: "admin" });  // own container, so listeners are removed with the page
  root.append(page);

  function draw() {
    const state = store.get();
    const products = select.products(state);
    const orders = services.orders.listAll();
    const revenue = orders.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.total, 0);
    const open = orders.filter((o) => o.status === "placed" || o.status === "shipped").length;
    const focusKey = document.activeElement?.dataset?.focusKey;

    page.replaceChildren(
      pageHeading("Admin", "Manage the catalog and move orders through delivery."),
      catalogBanner(state.catalog, () => actions.loadCatalog(true)) ?? "",
      el("dl", { class: "stats" },
        el("div", {}, el("dt", { text: "Products" }), el("dd", { text: String(products.length) })),
        el("div", {}, el("dt", { text: "Open orders" }), el("dd", { text: String(open) })),
        el("div", {}, el("dt", { text: "Revenue" }), el("dd", { text: formatPrice(revenue) }))),

      el("section", { "aria-labelledby": "admin-products" },
        el("div", { class: "section-head" },
          el("h2", { id: "admin-products", text: "Products" }),
          el("div", { class: "section-head__actions" },
            el("button", { class: "button button--quiet button--small", type: "button", "data-reset": true, "data-focus-key": "reset", text: "Restore original catalog" }),
            el("button", { class: "button button--small", type: "button", "data-add": true, "data-focus-key": "add", text: "Add product" }))),
        state.catalog.status === "loading" ? el("p", { text: "Loading products…" }) :
        el("div", { class: "table-wrap", role: "region", "aria-labelledby": "products-caption", tabindex: "0" },
          el("table", { class: "data-table" },
            el("caption", { id: "products-caption", class: "visually-hidden", text: "Product table" }),
            el("thead", {}, el("tr", {}, ["Product", "Category", "Price", "Actions"].map((h) => el("th", { scope: "col", text: h })))),
            el("tbody", {}, products.map((p) => el("tr", {},
              el("th", { scope: "row" }, el("a", { href: `#/product/${p.id}`, text: p.title }),
                p.local ? el("span", { class: "tag", text: "Added" }) : p.edited ? el("span", { class: "tag", text: "Edited" }) : null),
              el("td", { "data-label": "Category", text: categoryName(p.category) }),
              el("td", { "data-label": "Price", class: "num", text: formatPrice(p.price) }),
              el("td", { class: "actions" },
                el("button", { class: "button button--quiet button--small", type: "button", "data-edit": p.id, "data-focus-key": `edit-${p.id}` }, "Edit", hidden(` ${p.title}`)),
                el("button", { class: "button button--quiet button--small button--danger-text", type: "button", "data-delete": p.id }, "Delete", hidden(` ${p.title}`))))))))),

      el("section", { "aria-labelledby": "admin-orders" },
        el("h2", { id: "admin-orders", text: "Orders" }),
        orders.length ? el("div", { class: "table-wrap", role: "region", "aria-labelledby": "orders-caption", tabindex: "0" },
          el("table", { class: "data-table" },
            el("caption", { id: "orders-caption", class: "visually-hidden", text: "Order table, newest first" }),
            el("thead", {}, el("tr", {}, ["Order", "Customer", "Placed", "Total", "Status", "Update"].map((h) => el("th", { scope: "col", text: h })))),
            el("tbody", {}, orders.map((o) => {
              const next = nextStatus(o.status);
              return el("tr", {},
                el("th", { scope: "row", text: o.id }),
                el("td", { "data-label": "Customer", text: o.customer }),
                el("td", { "data-label": "Placed" }, timeEl(o.createdAt)),
                el("td", { "data-label": "Total", class: "num", text: formatPrice(o.total) }),
                el("td", { "data-label": "Status" }, statusBadge(o.status, STATUS_LABELS[o.status])),
                el("td", { class: "actions" }, next
                  ? el("button", { class: "button button--small", type: "button", "data-advance": o.id, "data-focus-key": `adv-${o.id}` }, `Mark ${STATUS_LABELS[next].toLowerCase()}`, hidden(` (order ${o.id})`))
                  : el("span", { class: "muted", text: "No action" })));
            }))))
          : el("p", { class: "muted", text: "No orders yet. Orders customers place will appear here." })));

    if (focusKey) (page.querySelector(`[data-focus-key="${focusKey}"]`) ?? page.querySelector("h1")).focus();
  }

  page.addEventListener("click", async (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    const state = store.get();
    const categories = select.categories(state);
    if ("add" in b.dataset) {
      openProductForm({ categories, onSave: (values) => {
        const result = actions.createProduct(values);
        if (!result.errors) toast(`Added “${result.product.title}”.`);
        return result;
      } });
    } else if (b.dataset.edit) {
      const product = select.products(state).find((p) => p.id === Number(b.dataset.edit));
      openProductForm({ product, categories, onSave: (values) => {
        const result = actions.saveProduct(product.id, values);
        if (!result.errors) toast(`Saved changes to “${values.title.trim()}”.`);
        return result;
      } });
    } else if (b.dataset.delete) {
      const product = select.products(state).find((p) => p.id === Number(b.dataset.delete));
      if (!await confirmDialog({ title: `Delete “${product.title}”?`, message: "It will be removed from the shop for everyone using this browser.", confirmLabel: "Delete product", danger: true })) return;
      actions.deleteProduct(product.id);
      toast(`Deleted “${product.title}”.`);
      page.querySelector("#admin-products").setAttribute("tabindex", "-1");
      page.querySelector("#admin-products").focus();
    } else if ("reset" in b.dataset) {
      if (!await confirmDialog({ title: "Restore the original catalog?", message: "All added, edited and deleted products go back to the FakeStoreAPI originals.", confirmLabel: "Restore catalog", danger: true })) return;
      actions.resetCatalog();
      toast("Catalog restored.");
    } else if (b.dataset.advance) {
      const order = actions.advanceOrder(b.dataset.advance);
      if (order) toast(`Order ${order.id} marked ${STATUS_LABELS[order.status].toLowerCase()}.`);
    }
  });

  draw();
  return store.subscribe((s, p) => {
    if (s.catalog !== p.catalog || s.overlay !== p.overlay || s.ordersVersion !== p.ordersVersion) draw();
  });
}
