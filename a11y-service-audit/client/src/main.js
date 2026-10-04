const form = document.getElementById("status-form");
const input = document.getElementById("file-number");
const errorEl = document.getElementById("file-number-error");
const result = document.getElementById("result");

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
  input.setAttribute("aria-invalid", "true");
  input.focus();
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
  input.removeAttribute("aria-invalid");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  result.textContent = "";

  const value = input.value.trim();
  if (!value) return showError("Enter your file number.");

  result.textContent = "Checking…";
  try {
    const res = await fetch(`/api/status/${encodeURIComponent(value)}`);
    const data = await res.json();
    if (!res.ok) {
      result.textContent = "";
      return showError(data.error);
    }
    result.innerHTML = "";
    const h2 = document.createElement("h2");
    h2.textContent = data.status;
    const p = document.createElement("p");
    p.textContent = data.nextStep;
    result.append(h2, p);
  } catch {
    result.textContent = "";
    showError("Could not reach the server. Check your connection and try again.");
  }
});
