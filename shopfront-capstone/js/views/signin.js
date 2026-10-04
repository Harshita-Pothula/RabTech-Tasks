/** Sign in, with one-click demo accounts for reviewers. */
import { el, template } from "../lib/dom.js";
import { bindForm, fieldHTML, errorSummaryHTML } from "../lib/forms.js";
import { DEMO_ACCOUNTS } from "../services/auth.js";

export const title = "Sign in";

export function render(ctx) {
  const { root, query, actions } = ctx;
  const form = el("form", { class: "form", id: "signin-form" });
  form.append(template(`
    ${errorSummaryHTML("We couldn't sign you in")}
    ${fieldHTML({ id: "si-email", name: "email", label: "Email", type: "email", error: "Enter your email address, like name@example.com", attrs: 'autocomplete="email" spellcheck="false"' })}
    ${fieldHTML({ id: "si-password", name: "password", label: "Password", type: "password", error: "Enter your password", attrs: 'autocomplete="current-password"' })}
    <div class="choice">
      <input id="si-remember" name="remember" type="checkbox">
      <label for="si-remember">Keep me signed in for 30 days</label>
    </div>
    <button class="button button--block" type="submit">Sign in</button>`));

  const next = query.next?.startsWith("#/") ? query.next : "#/";
  const demo = el("aside", { class: "demo-box", "aria-labelledby": "demo-title" },
    el("h2", { id: "demo-title", text: "Try a demo account" }),
    el("p", { text: "This is a portfolio project, so accounts are stored only in your browser." }),
    el("ul", {}, DEMO_ACCOUNTS.map((a) => el("li", {},
      el("strong", { text: a.role === "admin" ? "Admin: " : "Customer: " }),
      el("span", { text: `${a.email} / ${a.password} ` }),
      el("button", { class: "link-button", type: "button", "data-fill": a.email }, "Fill in")))));

  demo.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fill]");
    if (!b) return;
    const account = DEMO_ACCOUNTS.find((a) => a.email === b.dataset.fill);
    form.elements.email.value = account.email;
    form.elements.password.value = account.password;
    form.querySelector('[type="submit"]').focus();
  });

  bindForm(form, async (values, { showErrors }) => {
    const result = await actions.signIn(values, values.remember === "on");
    if (result.error) showErrors({ password: result.error.message });
    else location.hash = next;
  });

  root.append(el("div", { class: "auth-layout" },
    el("div", { class: "auth-card" },
      el("h1", { tabindex: "-1", text: "Sign in" }),
      el("p", {}, "New here? ", el("a", { href: `#/signup${next !== "#/" ? `?next=${encodeURIComponent(next)}` : ""}`, text: "Create an account" })),
      form),
    demo));
}
