/* ==========================================================
   Modal dialogs using the native <dialog> element
   - showModal() traps focus inside and makes the page behind inert.
   - Esc closes the dialog (built into <dialog>).
   - Focus returns to the button that opened it.
   Usage: <button data-open-dialog="dialog-id">  and  <button data-close-dialog>
   ========================================================== */
let lastTrigger = null;

document.addEventListener("click", (event) => {
  const opener = event.target.closest("[data-open-dialog]");
  if (opener) {
    const dialog = document.getElementById(opener.dataset.openDialog);
    if (!dialog) return;
    lastTrigger = opener;

    // Pre-fill the vehicle when the button belongs to a table row
    const vehicle = opener.dataset.vehicle;
    if (vehicle) {
      dialog.querySelectorAll("[data-vehicle-field]").forEach((field) => {
        if (field.tagName === "SELECT") field.value = vehicle;
        else field.textContent = vehicle;
      });
    }

    dialog.showModal();
    // Move focus to the first form control, or the first button
    const firstControl = dialog.querySelector("input, select, textarea") || dialog.querySelector("button");
    firstControl?.focus();
    return;
  }

  const closer = event.target.closest("[data-close-dialog]");
  if (closer) closer.closest("dialog")?.close("cancel");
});

// Return focus to the opener whenever any dialog closes (button, Esc, or form submit)
document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    lastTrigger?.focus();
    lastTrigger = null;
  });
});

// Confirm-type dialogs: announce the outcome in the page's status region
document.querySelectorAll("dialog[data-confirm-message]").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "confirm") return;
    const status = document.getElementById("page-status");
    const vehicle = dialog.querySelector("[data-vehicle-field]")?.textContent || "";
    if (status) status.textContent = dialog.dataset.confirmMessage.replace("{vehicle}", vehicle);
  });
});
