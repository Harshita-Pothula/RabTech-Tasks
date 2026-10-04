/**
 * storage.js
 * Safe, namespaced wrapper around localStorage.
 * Never throws: private browsing, full storage or corrupted JSON fall back gracefully.
 * The backing store is injectable so services can be unit tested in Node.
 */
export const NAMESPACE = "shopfront:";

export function createStorage(backing = globalThis.localStorage) {
  return {
    get(key, fallback = null) {
      try {
        const raw = backing.getItem(NAMESPACE + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        backing.setItem(NAMESPACE + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try { backing.removeItem(NAMESPACE + key); } catch { /* ignore */ }
    },
    /** Removes every key this app owns (used by "Reset demo data"). */
    clearAll() {
      try {
        for (let i = backing.length - 1; i >= 0; i--) {
          const key = backing.key(i);
          if (key && key.startsWith(NAMESPACE)) backing.removeItem(key);
        }
      } catch { /* ignore */ }
    },
  };
}
