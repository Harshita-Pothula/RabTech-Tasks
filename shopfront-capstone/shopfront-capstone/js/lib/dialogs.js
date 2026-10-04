/**
 * dialogs.js
 * Promise-based confirm dialog and a generic modal, built on native <dialog>
 * (focus is trapped inside, Esc closes, focus returns to the opener).
 */
import { el } from "./dom.js";

export function openModal({ title, labelledBy = "modal-title", body, className = "", onClose }) {
  const opener = document.activeElement;
  const dialog = el("dialog", { class: `modal ${className}`, "aria-labelledby": labelledBy });
  dialog.append(body);
  document.body.append(dialog);
  dialog.addEventListener("close", () => {
    dialog.remove();
    onClose?.(dialog.returnValue);
    if (opener && document.contains(opener)) opener.focus();
  });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close("cancel"); });
  dialog.showModal();
  return dialog;
}

/** Resolves true if the user confirms, false otherwise. */
export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const body = el("form", { method: "dialog" },
      el("div", { class: "modal__body" },
        el("h2", { id: "confirm-title", text: title }),
        el("p", { id: "confirm-desc", text: message })),
      el("div", { class: "modal__actions" },
        el("button", { class: "button button--quiet", type: "submit", value: "cancel", text: "Cancel" }),
        el("button", { class: `button${danger ? " button--danger" : ""}`, type: "submit", value: "confirm", text: confirmLabel })));
    const dialog = openModal({
      title, labelledBy: "confirm-title", body,
      className: danger ? "modal--alert" : "",
      onClose: (value) => resolve(value === "confirm"),
    });
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-describedby", "confirm-desc");
    dialog.querySelector('[value="cancel"]').focus(); // safest default
  });
}
