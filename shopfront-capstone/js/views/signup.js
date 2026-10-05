/** Create an account. */
import { el, template } from "../lib/dom.js";
import { bindForm, fieldHTML, errorSummaryHTML } from "../lib/forms.js";

export const title = "Create an account";

export function render(ctx) {
  const { root, query, actions } = ctx;
  const next = query.next?.startsWith("#/") ? query.next : "#/";
  const form = el("form", { class: "form", id: "signup-form" });
  form.append(template(`
    ${errorSummaryHTML("Fix these to create your account")}
    ${fieldHTML({ id: "su-name", name: "name", label: "Full name", error: "Enter your name", attrs: 'autocomplete="name" minlength="2" maxlength="80"' })}
    ${fieldHTML({ id: "su-email", name: "email", label: "Email", type: "email", error: "Enter an email address, like name@example.com", attrs: 'autocomplete="email" spellcheck="false" maxlength="120"' })}
    ${fieldHTML({ id: "su-password", name: "password", label: "Password", type: "password", hint: "At least 8 characters, with a letter and a number", error: "Use at least 8 characters, with a letter and a number", attrs: 'autocomplete="new-password" minlength="8" pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}"' })}
    ${fieldHTML({ id: "su-confirm", name: "confirm", label: "Confirm password", type: "password", error: "Enter the same password again", attrs: 'autocomplete="new-password"' })}
    <div class="choice">
      <input id="su-remember" name="remember" type="checkbox">
      <label for="su-remember">Keep me signed in for 30 days</label>
    </div>
    <button class="button button--block" type="submit">Create account</button>`));

  bindForm(form, async (values, { showErrors }) => {
    if (values.password !== values.confirm) { showErrors({ confirm: "Passwords don't match. Enter the same password again." }); return; }
    const result = await actions.signUp(values, values.remember === "on");
    if (result.error) showErrors({ [result.error.field ?? "email"]: result.error.message });
    else location.hash = next;
  });

  root.append(el("div", { class: "auth-layout auth-layout--single" },
    el("div", { class: "auth-card" },
      el("h1", { tabindex: "-1", text: "Create an account" }),
      el("p", {}, "Already have one? ", el("a", { href: `#/signin${next !== "#/" ? `?next=${encodeURIComponent(next)}` : ""}`, text: "Sign in" })),
      form)));
}
