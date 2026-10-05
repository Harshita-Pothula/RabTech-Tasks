/** Product detail page. Admins also get Edit and Delete here. */
import { el, hidden, formatPrice, categoryName, productImage } from "../lib/dom.js";
import { quantityOf } from "../lib/cart.js";
import { confirmDialog } from "../lib/dialogs.js";
import { openProductForm } from "./productForm.js";
import { catalogBanner } from "./shared.js";

export const title = "Product";

export function render(ctx) {
  const { root, store, params, actions, select, router, toast } = ctx;
  const id = Number(params.id);

  function draw() {
    const state = store.get();
    const back = el("p", { class: "back-link" }, el("a", { href: "#/", text: "← Back to shop" }));

    if (state.catalog.status === "loading") {
      root.replaceChildren(back, el("div", { class: "product-detail product-detail--loading", "aria-busy": "true" },
        el("span", { class: "skeleton skeleton--image" }),
        el("div", {}, el("h1", { tabindex: "-1", class: "visually-hidden", text: "Loading product" }),
          el("span", { class: "skeleton skeleton--line" }), el("span", { class: "skeleton skeleton--line skeleton--short" }))));
      return;
    }
    if (state.catalog.status === "error") {
      root.replaceChildren(back, el("h1", { tabindex: "-1", text: "Product unavailable" }), catalogBanner(state.catalog, () => actions.loadCatalog(true)));
      return;
    }

    const product = select.products(state).find((p) => p.id === id);
    if (!product) {
      document.title = "Product not found | Shopfront";
      root.replaceChildren(back,
        el("h1", { tabindex: "-1", text: "Product not found" }),
        el("p", { text: "This product may have been removed. Browse the shop to find something similar." }),
        el("a", { class: "button", href: "#/", text: "Browse the shop" }));
      return;
    }
    document.title = `${product.title} | Shopfront`;

    const inCart = quantityOf(state.cart, product.id);
    const qty = el("select", { id: "qty", name: "qty" },
      Array.from({ length: 10 }, (_, i) => el("option", { value: i + 1, text: String(i + 1) })));
    const isAdmin = state.user?.role === "admin";

    root.replaceChildren(back,
      el("article", { class: "product-detail" },
        productImage(product, { size: 480, eager: true }),
        el("div", { class: "product-detail__info" },
          el("p", { class: "product-card__category", text: categoryName(product.category) }),
          el("h1", { tabindex: "-1", text: product.title }),
          product.rating?.count
            ? el("p", { class: "product-card__rating" },
                el("span", { "aria-hidden": "true", text: `★ ${product.rating.rate.toFixed(1)} · ${product.rating.count} reviews` }),
                hidden(`Rated ${product.rating.rate} out of 5 from ${product.rating.count} reviews`))
            : null,
          el("p", { class: "product-detail__price", text: formatPrice(product.price) }),
          el("p", { class: "product-detail__description", text: product.description || "No description yet." }),
          el("div", { class: "product-detail__buy" },
            el("div", { class: "qty-field" }, el("label", { for: "qty", text: "Quantity" }), qty),
            el("button", { class: "button", type: "button", "data-add": true, text: "Add to cart" })),
          inCart ? el("p", { class: "in-cart" }, `${inCart} in your cart. `, el("a", { href: "#/cart", text: "View cart" })) : null,
          isAdmin ? el("div", { class: "admin-actions" },
            el("h2", { class: "admin-actions__title", text: "Admin" }),
            el("button", { class: "button button--quiet button--small", type: "button", "data-edit": true, text: "Edit product" }),
            el("button", { class: "button button--quiet button--small button--danger-text", type: "button", "data-delete": true, text: "Delete product" })) : null)));

    root.querySelector("[data-add]").addEventListener("click", () => actions.addToCart(product.id, Number(qty.value)));
    root.querySelector("[data-edit]")?.addEventListener("click", () =>
      openProductForm({ product, categories: select.categories(store.get()), onSave: (values) => actions.saveProduct(product.id, values) }));
    root.querySelector("[data-delete]")?.addEventListener("click", async () => {
      const ok = await confirmDialog({ title: `Delete “${product.title}”?`, message: "It will be removed from the shop. You can restore the original catalog from the admin page.", confirmLabel: "Delete product", danger: true });
      if (!ok) return;
      actions.deleteProduct(product.id);
      toast(`Deleted “${product.title}”.`);
      router.navigate("/admin");
    });
  }

  draw();
  return store.subscribe((state, prev) => {
    if (state.catalog !== prev.catalog || state.overlay !== prev.overlay || state.cart !== prev.cart) {
      const focused = document.activeElement?.matches?.("[data-add]");
      draw();
      if (focused) root.querySelector("[data-add]")?.focus();
    }
  });
}
