/* ==========================================================
   Sidebar toggle (mobile)
   - The button reports its state with aria-expanded.
   - Without JavaScript the sidebar is always visible.
   ========================================================== */
document.documentElement.classList.add("js");

const toggle = document.querySelector(".sidebar-toggle");
const sidebar = document.getElementById("sidebar");

if (toggle && sidebar) {
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    sidebar.classList.toggle("is-open", !isOpen);
    if (!isOpen) sidebar.querySelector("a")?.focus();
  });

  // Esc closes the open sidebar and returns focus to the toggle
  sidebar.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
      toggle.click();
      toggle.focus();
    }
  });
}
