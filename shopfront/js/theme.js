/* ==========================================================
   Theme: light / dark
   - Loaded in <head> (not deferred) so the saved theme applies
     before the page paints, avoiding a flash of the wrong theme.
   - Default follows the operating system (prefers-color-scheme).
   - The toggle uses aria-pressed: "Dark theme" pressed = dark on.
   ========================================================== */
(function () {
  const root = document.documentElement;
  root.classList.add("js");

  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) { /* storage blocked */ }
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;

  const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : systemDark.matches);

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.querySelector(".theme-toggle");
    if (!button) return;
    const sync = () => button.setAttribute("aria-pressed", String(isDark()));
    sync();
    systemDark.addEventListener("change", sync);

    button.addEventListener("click", () => {
      const next = isDark() ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("theme", next); } catch (e) { /* storage blocked */ }
      sync();
    });
  });
})();
