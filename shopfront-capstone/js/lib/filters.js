/**
 * filters.js
 * Pure functions for search, category filtering and sorting.
 * No DOM access, so they are easy to unit test.
 */

export const SORT_OPTIONS = {
  featured: "Featured",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  rating: "Top rated",
  "title-asc": "Name: A to Z",
};

/** Lower-case and strip accents so "Jalapeño" matches "jalapeno". */
export const normalize = (text = "") =>
  text.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Every word in the query must appear in the title, category or description. */
export function matchesQuery(product, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(`${product.title} ${product.category} ${product.description}`);
  return words.every((word) => haystack.includes(word));
}

export function filterProducts(products, { query = "", category = "all" } = {}) {
  return products.filter(
    (product) => (category === "all" || product.category === category) && matchesQuery(product, query)
  );
}

const comparators = {
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  rating: (a, b) => b.rating.rate - a.rating.rate || b.rating.count - a.rating.count,
  "title-asc": (a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
};

/** Returns a new array; "featured" keeps the API's original order. */
export function sortProducts(products, sortKey = "featured") {
  const compare = comparators[sortKey];
  return compare ? [...products].sort(compare) : [...products];
}

/** The full pipeline used by the app: filter, then sort. */
export const applyView = (products, view) => sortProducts(filterProducts(products, view), view.sort);

/** Count products per category, for the tab labels. */
export function countByCategory(products) {
  return products.reduce((counts, { category }) => {
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, { all: products.length });
}
