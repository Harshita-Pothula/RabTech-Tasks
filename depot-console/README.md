# Depot Console: Semantic HTML5 & Accessible Component Architecture

The structural foundation for an enterprise dashboard: a maintenance console for a city bus depot. Built with strict HTML5 semantics, WCAG 2.1 AA accessibility, and a reusable component structure. No frameworks, no build step.

## Pages

| Page | What it shows | Key components |
|------|---------------|----------------|
| [`index.html`](index.html) | Depot overview: today's figures, workshop bays, inspections due, shift notes | Description list, ordered list of bays, data table, articles |
| [`vehicles.html`](vehicles.html) | Fleet list with row actions | Data table, two modal dialogs (form dialog + confirmation dialog) |
| [`maintenance.html`](maintenance.html) | Schedule a bus into a workshop bay | Full accessible form with fieldsets, validation and error summary |

## Project structure

```
depot-console/
├── index.html              # Overview (dashboard home)
├── vehicles.html           # Fleet table + modal dialogs
├── maintenance.html        # Accessible form
└── components/
    ├── base.css            # Design tokens, typography, focus ring, skip link, buttons, status labels
    ├── layout.css          # Header, sidebar, main, footer grid + overview widgets
    ├── data-table.css      # Data table component
    ├── modal.css           # Modal dialog component
    ├── form.css            # Form controls, fieldsets, errors, error summary
    ├── sidebar.js          # Mobile sidebar toggle (aria-expanded)
    ├── modal.js            # Opens/closes native <dialog>, returns focus
    └── form-validation.js  # Accessible validation + error summary
```

Each page loads only the components it uses.

## Semantic HTML5 structure

Every page follows the same landmark hierarchy:

```
body
├── a.skip-link               "Skip to main content"
├── header                    banner: brand, search (role="search"), signed-in user
├── div.shell
│   ├── aside#sidebar
│   │   ├── nav[aria-label="Primary"]   current page marked with aria-current="page"
│   │   └── section                     workshop hours
│   └── main#main
│       ├── h1                          one per page
│       ├── section[aria-labelledby]    each with its own h2
│       └── article                     self-contained items (shift notes)
└── footer                    contentinfo, with nav[aria-label="Footer"]
```

Tags used: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`, plus `<dl>`, `<ol>`, `<table>` with `<caption>`, `<time datetime>`, `<dialog>`, `<fieldset>` and `<legend>`.

Headings never skip levels (`h1` then `h2` then `h3`), so screen reader users can navigate the page by heading.

## Accessibility (WCAG 2.1 AA)

| Requirement | How it's met | WCAG |
|-------------|--------------|------|
| Skip repeated content | Skip link is the first focusable element on every page | 2.4.1 |
| Landmarks and structure | Semantic landmarks, labelled sections, logical heading order | 1.3.1 |
| Keyboard access | Only real `<a>` and `<button>` elements; no clickable `div`s | 2.1.1 |
| Visible focus | Dark outline + yellow halo on every focusable element | 2.4.7 |
| Data tables | `<caption>`, `scope="col"` and `scope="row"`, scrollable region is focusable and labelled | 1.3.1 |
| Unique button names | Row buttons include hidden text, e.g. "Log repair for TG09 Z 7730" | 2.4.6, 4.1.2 |
| Modal dialogs | Native `<dialog>` with `showModal()`: focus moves in, page behind is inert, Esc closes, focus returns to the opener | 2.1.2, 2.4.3 |
| Confirmation dialog | `role="alertdialog"` with `aria-labelledby` and `aria-describedby` | 4.1.2 |
| Form labels | Every control has a visible `<label for>`; related controls are grouped in `<fieldset>` with `<legend>` | 1.3.1, 3.3.2 |
| Hints | Linked to inputs with `aria-describedby` | 3.3.2 |
| Validation | `required`, `pattern`, `min`, `max`, `step`, `minlength`, `maxlength`, `type="email"`, `type="tel"`, `type="date"`, `type="time"` | 3.3.1 |
| Error messages | Shown next to the field, prefixed "Error:", linked with `aria-describedby`, field marked `aria-invalid="true"` | 3.3.1, 3.3.3 |
| Error summary | Appears at the top on failed submit, receives focus, each item links to its field | 3.3.1 |
| Status updates | Success messages use `role="status"`, so screen readers announce them without moving focus | 4.1.3 |
| Not colour alone | Status labels use text and a different shape (circle, diamond, square) | 1.4.1 |
| Contrast | Text and input borders meet 4.5:1 and 3:1 minimums | 1.4.3, 1.4.11 |
| Touch targets | Buttons and inputs are at least 44px tall | 2.5.5 |
| Autofill | `autocomplete="name"`, `"email"`, `"tel"` on personal details | 1.3.5 |
| Reduced motion | Animations disabled under `prefers-reduced-motion` | 2.3.3 |
| Language | `<html lang="en">` and a unique `<title>` on each page | 3.1.1, 2.4.2 |

## W3C validation

All three pages and all CSS files pass the W3C Nu HTML Checker with **0 errors and 0 warnings**.

To check it yourself, open <https://validator.w3.org/nu/>, choose **File upload**, and upload each HTML file, or use **Address** with the GitHub Pages link once published.

## Run locally

No install needed. Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
# then open http://localhost:8000
```

## Try the components

1. Press **Tab** on any page: the first stop is "Skip to main content".
2. On **Fleet**, press "Log repair" in any row. The dialog opens with that bus already selected. Press "Save repair" without filling it in to see the error summary. Press **Esc** to close; focus returns to the button you used.
3. On **Schedule maintenance**, submit the empty form to see all ten errors listed and linked.
4. Narrow the window below 830px: the sidebar collapses behind a "Menu" button.
