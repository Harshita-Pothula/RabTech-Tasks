/* ==========================================================
   Theme: light / dark
   - Loaded in <head> (not deferred) so the saved theme applies
     before the page paints, avoiding a flash of the wrong theme.
   - Default follows the device setting (prefers-color-scheme).
   - The button says what it will do: "Dark theme" while the page is light,
     "Light theme" while it's dark. Its label is also its accessible name.
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
    const label = button.querySelector(".theme-toggle__label");

    const sync = () => {
      const dark = isDark();
      label.textContent = dark ? "Light theme" : "Dark theme";
      button.dataset.switchTo = dark ? "light" : "dark"; // CSS shows a sun or a moon
    };
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
