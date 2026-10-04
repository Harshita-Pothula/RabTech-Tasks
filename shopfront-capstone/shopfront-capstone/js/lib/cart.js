/**
 * cart.js
 * Pure cart logic. The cart is an array of
 *   { id, title, price, image, quantity }
 * Each item keeps a snapshot of the product, so the cart still shows
 * correctly from localStorage even if the API is unavailable.
 * Every function returns a NEW array (no mutation), which keeps state changes predictable.
 */

export const MAX_QUANTITY = 99;

export function addItem(cart, product, amount = 1) {
  const existing = cart.find((item) => item.id === product.id);
  if (existing) return setQuantity(cart, product.id, existing.quantity + amount);
  const { id, title, price, image } = product;
  return [...cart, { id, title, price, image, quantity: Math.min(amount, MAX_QUANTITY) }];
}

/** Sets an exact quantity. 0 or less removes the item. */
export function setQuantity(cart, id, quantity) {
  const qty = Math.min(Math.floor(Number(quantity) || 0), MAX_QUANTITY);
  if (qty <= 0) return removeItem(cart, id);
  return cart.map((item) => (item.id === id ? { ...item, quantity: qty } : item));
}

export const removeItem = (cart, id) => cart.filter((item) => item.id !== id);

export const cartCount = (cart) => cart.reduce((sum, item) => sum + item.quantity, 0);

/** Total in cents first, to avoid floating point errors like 0.1 + 0.2. */
export const cartTotal = (cart) =>
  cart.reduce((cents, item) => cents + Math.round(item.price * 100) * item.quantity, 0) / 100;

export const quantityOf = (cart, id) => cart.find((item) => item.id === id)?.quantity ?? 0;

/** Guards against corrupted or tampered localStorage data. */
export function sanitizeCart(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) =>
      item && Number.isInteger(item.id) && typeof item.title === "string" &&
      Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0)
    .map((item) => ({ ...item, quantity: Math.min(item.quantity, MAX_QUANTITY) }));
}
