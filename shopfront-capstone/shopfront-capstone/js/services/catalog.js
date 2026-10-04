/**
 * catalog.js
 * Combines products from FakeStoreAPI with the admin's local changes.
 * Local changes are stored as an "overlay" on top of the API data:
 *   created: products added by the admin (ids from 1000 up)
 *   updated: { [apiProductId]: changed fields }
 *   deleted: ids hidden from the catalog
 * The API data itself is never modified, so "Restore original catalog" is simple.
 */
import * as api from "../api.js";

export const LOCAL_ID_START = 1000;
export const emptyOverlay = () => ({ created: [], updated: {}, deleted: [], nextId: LOCAL_ID_START });

export function mergeCatalog(apiProducts = [], overlay = emptyOverlay()) {
  const deleted = new Set(overlay.deleted);
  const fromApi = apiProducts
    .filter((p) => !deleted.has(p.id))
    .map((p) => (overlay.updated[p.id] ? { ...p, ...overlay.updated[p.id], edited: true } : p));
  return [...fromApi, ...overlay.created.filter((p) => !deleted.has(p.id))];
}

/**
 * Checks and cleans product form input.
 * @returns {{ value: object, errors: Record<string,string> }}
 */
export function validateProduct(input = {}) {
  const errors = {};
  const title = String(input.title ?? "").trim();
  const price = Number(input.price);
  const category = String(input.category ?? "").trim().toLowerCase();
  const description = String(input.description ?? "").trim();
  const image = String(input.image ?? "").trim();

  if (title.length < 3 || title.length > 120) errors.title = "Enter a product name between 3 and 120 characters.";
  if (!Number.isFinite(price) || price <= 0 || price > 100000) errors.price = "Enter a price between 0.01 and 100,000.";
  else if (Math.round(price * 100) !== price * 100) errors.price = "Use at most 2 decimal places for the price.";
  if (!category || category.length > 40) errors.category = "Choose or enter a category (up to 40 characters).";
  if (description.length > 1000) errors.description = "Keep the description under 1,000 characters.";
  if (image && !/^https:\/\/[^\s]+$/i.test(image)) errors.image = "Image address must start with https://";

  return { value: { title, price, category, description, image }, errors };
}

export function createCatalogService({ storage, remote = api, onRemoteError = () => {} }) {
  const load = () => ({ ...emptyOverlay(), ...storage.get("catalog-overlay", {}) });
  const save = (overlay) => { storage.set("catalog-overlay", overlay); return overlay; };

  // Send the change to the REST API too. It doesn't persist writes, so failures are logged, not fatal.
  const sync = (promise) => promise.catch(onRemoteError);

  return {
    getOverlay: load,

    create(input) {
      const { value, errors } = validateProduct(input);
      if (Object.keys(errors).length) return { errors };
      const overlay = load();
      const product = { id: overlay.nextId, ...value, rating: { rate: 0, count: 0 }, local: true };
      sync(remote.createProduct(value));
      return { product, overlay: save({ ...overlay, created: [...overlay.created, product], nextId: overlay.nextId + 1 }) };
    },

    update(id, input) {
      const { value, errors } = validateProduct(input);
      if (Object.keys(errors).length) return { errors };
      const overlay = load();
      const isLocal = overlay.created.some((p) => p.id === id);
      const next = isLocal
        ? { ...overlay, created: overlay.created.map((p) => (p.id === id ? { ...p, ...value } : p)) }
        : { ...overlay, updated: { ...overlay.updated, [id]: value } };
      if (!isLocal) sync(remote.updateProduct(id, value));
      return { overlay: save(next) };
    },

    remove(id) {
      const overlay = load();
      const isLocal = overlay.created.some((p) => p.id === id);
      const next = isLocal
        ? { ...overlay, created: overlay.created.filter((p) => p.id !== id) }
        : { ...overlay, deleted: [...new Set([...overlay.deleted, id])] };
      if (!isLocal) sync(remote.deleteProduct(id));
      return { overlay: save(next) };
    },

    reset() {
      return { overlay: save(emptyOverlay()) };
    },
  };
}
