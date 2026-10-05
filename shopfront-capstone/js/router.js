/**
 * router.js
 * Hash-based router (#/product/3). Hash routes work on any static host
 * (Netlify, Vercel, GitHub Pages) with no server rewrite rules.
 */

/** "#/cart?x=1" -> { path: "/cart", query: { x: "1" } } */
export function parseHash(hash = "") {
  const raw = hash.replace(/^#/, "") || "/";
  const [path, queryString = ""] = raw.split("?");
  return { path: path || "/", query: Object.fromEntries(new URLSearchParams(queryString)) };
}

export function buildHash(path, query = {}) {
  const params = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));
  const qs = params.toString();
  return `#${path}${qs ? `?${qs}` : ""}`;
}

/** Finds the first route whose pattern matches, e.g. "/product/:id". */
export function matchRoute(routes, path) {
  for (const route of routes) {
    const names = [];
    const pattern = route.path.replace(/:([a-zA-Z]+)/g, (_, name) => { names.push(name); return "([^/]+)"; });
    const match = path.match(new RegExp(`^${pattern}/?$`));
    if (match) {
      const params = Object.fromEntries(names.map((name, i) => [name, decodeURIComponent(match[i + 1])]));
      return { route, params };
    }
  }
  return null;
}

/**
 * Decides what to show for a route, given who is signed in.
 * @returns {{type:"render", route, params} | {type:"redirect", to:string} | {type:"forbidden"} | {type:"notfound"}}
 */
export function resolveRoute(routes, { path, query }, user) {
  const found = matchRoute(routes, path);
  if (!found) return { type: "notfound" };
  const { route, params } = found;
  const here = buildHash(path, query);

  if (route.access === "user" && !user) return { type: "redirect", to: buildHash("/signin", { next: here }) };
  if (route.access === "admin") {
    if (!user) return { type: "redirect", to: buildHash("/signin", { next: here }) };
    if (user.role !== "admin") return { type: "forbidden" };
  }
  if (route.access === "guest" && user) {
    const next = query.next && query.next.startsWith("#/") ? query.next : "#/";
    return { type: "redirect", to: next };
  }
  return { type: "render", route, params };
}

export function createRouter({ routes, getUser, onRender }) {
  let current = parseHash(location.hash);

  function run() {
    current = parseHash(location.hash);
    const result = resolveRoute(routes, current, getUser());
    if (result.type === "redirect") {
      location.replace(result.to); // replace, so Back doesn't bounce into the redirect again
      return;
    }
    onRender(result, current);
  }

  window.addEventListener("hashchange", run);

  return {
    start: run,
    refresh: run,
    navigate: (path, query) => { location.hash = buildHash(path, query); },
    /** Update the query string without re-rendering (used while typing in search). */
    replaceQuery: (query) => history.replaceState(null, "", buildHash(current.path, query)),
    get current() { return current; },
  };
}
