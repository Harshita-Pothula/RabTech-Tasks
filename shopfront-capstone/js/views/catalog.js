/** Catalog: live search, category tabs, sorting. Filters live in the URL (#/?q=...) and preferences. */
import { el, slug, categoryName } from "../lib/dom.js";
import { applyView, countByCategory, SORT_OPTIONS } from "../lib/filters.js";
import { pageHeading, productCard, skeletonCards, catalogBanner } from "./shared.js";

export const title = "Shop";

export function render(ctx) {
  const { root, store, query, router, actions, select } = ctx;
  const prefs = store.get().prefs;
  const view = {
    query: query.q ?? "",
    category: query.category ?? prefs.category,
    sort: query.sort in SORT_OPTIONS ? query.sort : prefs.sort,
  };

  const search = el("input", {
    id: "search", type: "search", name: "q", placeholder: "Search products", autocomplete: "off",
    value: view.query, "aria-describedby": "search-hint",
  });
  const sort = el("select", { id: "sort", name: "sort" },
    Object.entries(SORT_OPTIONS).map(([value, label]) => el("option", { value, text: label, selected: value === view.sort })));
  const status = el("p", { id: "results-status", class: "results-status", role: "status" });
  const bannerSlot = el("div", { class: "banner-slot" });
  const tabs = el("div", { class: "tabs", role: "tablist", "aria-label": "Product categories" });
  const grid = el("ul", { class: "product-grid" });
  const empty = el("div", { class: "empty-state", hidden: true },
    el("p", { class: "empty-state__title", "data-empty-message": true }),
    el("p", { text: "Try a shorter word, check the spelling, or look in another category." }),
    el("div", { class: "empty-state__actions" },
      el("button", { class: "button", type: "button", "data-clear-search": true, text: "Clear search" }),
      el("button", { class: "button button--quiet", type: "button", "data-show-all": true, text: "Show all categories" })));
  const panel = el("section", { id: "product-panel", class: "product-panel", role: "tabpanel", "aria-busy": "true" },
    el("h2", { class: "visually-hidden", text: "Product list" }), grid, empty);

  root.append(
    pageHeading("Shop", "Everyday products, delivered across India. Prices in US dollars (sample data)."),
    el("form", { class: "catalog-search", role: "search", onsubmit: (e) => e.preventDefault() },
      el("label", { for: "search", class: "visually-hidden", text: "Search products" }),
      search,
      el("span", { id: "search-hint", class: "visually-hidden", text: "Results update as you type. Press slash to jump here." })),
    bannerSlot,
    el("div", { class: "toolbar" }, tabs,
      el("div", { class: "sort" }, el("label", { for: "sort", text: "Sort by" }), sort)),
    status,
    panel);

  function draw() {
    const state = store.get();
    const { catalog } = state;
    bannerSlot.replaceChildren(catalogBanner(catalog, () => actions.loadCatalog(true)) ?? "");

    if (catalog.status === "loading") {
      panel.setAttribute("aria-busy", "true");
      tabs.replaceChildren(...Array.from({ length: 5 }, () => el("span", { class: "tab tab--skeleton", "aria-hidden": "true" })));
      grid.replaceChildren(...skeletonCards());
      empty.hidden = true;
      status.textContent = "Loading products…";
      return;
    }
    panel.setAttribute("aria-busy", "false");
    if (catalog.status === "error") {
      tabs.replaceChildren(); grid.replaceChildren(); empty.hidden = true; status.textContent = "";
      return;
    }

    const products = select.products(state);
    const categories = select.categories(state);
    if (view.category !== "all" && !categories.includes(view.category)) view.category = "all";

    const counts = countByCategory(products);
    const hadFocus = tabs.contains(document.activeElement);
    tabs.replaceChildren(...["all", ...categories].map((key) => el("button", {
      type: "button", class: "tab", id: `tab-${slug(key)}`, role: "tab",
      "aria-selected": String(key === view.category), "aria-controls": "product-panel",
      tabIndex: key === view.category ? 0 : -1, "data-category": key,
    }, categoryName(key), el("span", { class: "tab__count", text: String(counts[key] ?? 0) }))));
    panel.setAttribute("aria-labelledby", `tab-${slug(view.category)}`);
    if (hadFocus) tabs.querySelector('[aria-selected="true"]').focus();

    const visible = applyView(products, view);
    grid.replaceChildren(...visible.map((p) => productCard(p, state.cart)));
    empty.hidden = visible.length > 0;
    if (!visible.length) {
      const where = view.category === "all" ? "" : ` in ${categoryName(view.category)}`;
      empty.querySelector("[data-empty-message]").textContent = view.query ? `No products match “${view.query}”${where}.` : `There are no products${where}.`;
      empty.querySelector("[data-clear-search]").hidden = !view.query;
      empty.querySelector("[data-show-all]").hidden = view.category === "all";
    }
    const where = view.category === "all" ? "" : ` in ${categoryName(view.category)}`;
    status.textContent = `Showing ${visible.length} of ${products.length} products${where}${view.query ? ` matching “${view.query}”` : ""}.`;
  }

  function update(patch) {
    Object.assign(view, patch);
    router.replaceQuery({ q: view.query, category: view.category === "all" ? "" : view.category, sort: view.sort === "featured" ? "" : view.sort });
    actions.savePrefs({ category: view.category, sort: view.sort });
    draw();
  }

  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => update({ query: search.value.trim() }), 150);
  });
  sort.addEventListener("change", () => update({ sort: sort.value }));

  tabs.addEventListener("click", (event) => {
    const tab = event.target.closest("[role=tab]");
    if (!tab) return;
    update({ category: tab.dataset.category });
    tabs.querySelector('[aria-selected="true"]').focus();
  });
  tabs.addEventListener("keydown", (event) => {
    const all = [...tabs.querySelectorAll("[role=tab]")];
    const index = all.indexOf(document.activeElement);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: all.length - 1 }[event.key];
    if (index === -1 || next === undefined) return;
    event.preventDefault();
    update({ category: all[(next + all.length) % all.length].dataset.category });
    tabs.querySelector('[aria-selected="true"]').focus();
  });

  empty.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-search]")) { search.value = ""; update({ query: "" }); search.focus(); }
    if (event.target.closest("[data-show-all]")) update({ category: "all" });
  });

  grid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-to-cart]");
    if (button) actions.addToCart(Number(button.dataset.addToCart));
  });

  // "/" jumps to search
  const onKey = (event) => {
    if (event.key === "/" && !event.target.closest("input, textarea, select") && !document.querySelector("dialog[open]")) {
      event.preventDefault();
      search.focus();
    }
  };
  document.addEventListener("keydown", onKey);

  draw();
  const unsubscribe = store.subscribe((state, prev) => {
    if (state.catalog !== prev.catalog || state.overlay !== prev.overlay) draw();
    else if (state.cart !== prev.cart) {
      // update buttons only, so keyboard focus stays where it is
      const focusedId = document.activeElement?.dataset?.addToCart;
      draw();
      if (focusedId) grid.querySelector(`[data-add-to-cart="${focusedId}"]`)?.focus();
    }
  });
  return () => { unsubscribe(); document.removeEventListener("keydown", onKey); clearTimeout(timer); };
}
