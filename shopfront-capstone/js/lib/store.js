/** Tiny observable store: set() merges a patch and notifies subscribers with (state, previous). */
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const previous = state;
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((fn) => fn(state, previous));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
