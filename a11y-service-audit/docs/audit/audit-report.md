# Audit report: Passport Seva

**URL audited:** <https://www.passportindia.gov.in>
**Date:** 27 Sep 2026
**Auditor:** Harshita
**Tools:** Chrome Lighthouse 13.4.1 (Accessibility, desktop emulation), keyboard-only pass, Chrome DevTools

## Summary

The Passport Seva home page scores **72/100** on Lighthouse accessibility. The score hides bigger problems: the main navigation and the menu button are not properly exposed to screen readers, over 80 hidden carousel slides still capture keyboard focus, and 23 images have no text alternative. The keyboard-only pass confirmed this: there is no skip link, every main menu item is skipped by Tab, and focus gets stuck in the circulars carousel and disappears onto off-screen slides. Three issues are rated P1 because they can stop a keyboard or screen reader user from getting around the site at all.

## 1. Lighthouse score

| Page | Accessibility | Screenshot |
|------|---------------|------------|
| Home | 72 / 100 | `screenshots/lighthouse-home.png` |

Failed automated checks: ARIA attributes not matching roles, focusable content inside `aria-hidden`, buttons without accessible names, images without `alt`, invalid list structure, missing `main` landmark. Lighthouse also lists 10 items that need manual checking, including keyboard focus and tab order, which the keyboard pass below covers.

## 2. Keyboard-only pass

Mouse not used. Only Tab, Shift+Tab, Enter, Space, arrow keys and Esc.

| Step | Expected | What happened | Pass/Fail |
|------|----------|---------------|-----------|
| Press Tab on page load | A "Skip to main content" link appears | No skip link. First Tab went straight to Search | Fail |
| Tab to main menu (About Us, Services…) | Each item gets a visible focus outline | Menu items never received focus. Order was Search → Login → Register → "View More" in Public Notice | Fail |
| Press Enter on a menu item | Dropdown opens, arrow keys move inside it | Could not test: menu items cannot be reached by keyboard | Fail |
| Tab past the carousels | Focus skips slides that are not visible | After 15+ Tab presses focus was still inside the Latest News circulars | Fail |
| Reach the chatbot | Chatbot button is focusable and opens with Enter | Not tested | — |
| Any point on the page | Focus is never trapped and always visible | Focus box disappeared onto off-screen carousel slides | Fail |

**Result:** 5 of 5 tested steps failed. The keyboard pass raised WEB-001 from High to Critical and WEB-003 from P2 to P1.

## 3. Findings

Full data in [`accessibility-audit.csv`](accessibility-audit.csv).

### WEB-001: Navigation dropdowns are fake links
- **Where:** Main menu (About Us, Passport Offices, Services, Useful Links, Contact Us)
- **WCAG:** 4.1.2 Name, Role, Value; 2.1.1 Keyboard
- **Evidence:** `screenshots/web-001.png`. The menu items are `<a>` tags with no `href` but with `aria-expanded`, which is not valid on a plain link. All five share the same `id="collasible-nav-dropdown3"`.
- **Keyboard pass:** Tab skipped every menu item (Search → Login → Register → "View More").
- **Who is affected:** Keyboard-only users cannot open any menu section at all. Screen reader users are not told these open a submenu.
- **Severity:** Critical
- **Fix:** Use `<button type="button" aria-expanded="false">` for each toggle, update `aria-expanded` when it opens, give every element a unique `id`.
- **Priority:** P1

### WEB-002: Menu button has no name
- **Where:** Header, `button.menu-btn`
- **WCAG:** 4.1.2 Name, Role, Value
- **Evidence:** `screenshots/web-002.png`. The `<button>` contains no text and no `aria-label`.
- **Who is affected:** Screen readers announce only "button", so blind users cannot tell what it does.
- **Severity:** High
- **Fix:** Add `aria-label="Open menu"` and an `aria-expanded` state.
- **Priority:** P1

### WEB-003: Hidden carousel slides still take keyboard focus
- **Where:** Announcements and circulars carousels on the home page
- **WCAG:** 4.1.2 Name, Role, Value; 2.4.4 Link Purpose; 2.4.7 Focus Visible
- **Evidence:** `screenshots/web-003.png`. Over 80 slides (including cloned slides from the carousel library) are marked `aria-hidden="true"` but contain focusable "Know More" links. Every link has the same text.
- **Keyboard pass:** after 15+ Tab presses focus was still inside the circulars, and the focus box vanished onto slides that were off-screen.
- **Who is affected:** Keyboard users tab through dozens of invisible links. Screen reader users land on links they are told don't exist, and hear "Know More" with no context.
- **Severity:** High
- **Fix:** Remove hidden slide links from the tab order (`tabindex="-1"` or `inert`) and give each link a unique name, e.g. "Know more about Tatkaal Passport".
- **Priority:** P1

### WEB-004: 23 images without alt text
- **Where:** Emblem logo, 8 service cards, chatbot button, phone and star icons
- **WCAG:** 1.1.1 Non-text Content
- **Evidence:** `screenshots/web-004.png`
- **Who is affected:** Screen reader users. The chatbot is an image used as a button, so it has no name and is effectively unusable without sight.
- **Severity:** Medium
- **Fix:** Meaningful `alt` for informative images, `alt=""` for decorative ones, and a real `<button aria-label="Open chat assistant">` for the chatbot.
- **Priority:** P2

### WEB-005: Broken page structure
- **Where:** Whole page
- **WCAG:** 1.3.1 Info and Relationships; 2.4.1 Bypass Blocks
- **Evidence:** `screenshots/web-005.png`. No skip link (first Tab lands on Search), no `<main>` landmark, `<li>` items outside any `<ul>`, `<br>` tags inside a `<ul>`, and 6 empty `<h4>` tags used for spacing.
- **Who is affected:** Screen reader users cannot jump to main content, hear wrong list counts, and hit blank headings.
- **Severity:** Low
- **Fix:** Wrap content in `<main>`, fix list markup, replace empty headings with CSS margins.
- **Priority:** P3

## 4. Remediation priority

| Priority | Issues | Why |
|----------|--------|-----|
| P1 | WEB-001, WEB-002, WEB-003 | Block keyboard users from the menu, hide the menu button's purpose, and trap focus in invisible slides |
| P2 | WEB-004 | Images and the chatbot are unusable for screen reader users, but the rest of the page still works |
| P3 | WEB-005 | Structural problems with workarounds, but cheap to fix |

## 5. How findings shaped this repo

| Finding | What our skeleton does instead |
|---------|--------------------------------|
| WEB-001 fake links as menu toggles | Navigation uses real `<a href>` links in a `<ul>`; actions use real `<button>` elements |
| WEB-002 unnamed button | Every button has visible text ("Check status") |
| WEB-003 focus on hidden content | No hidden focusable content; results appear in an `aria-live` region without stealing focus |
| WEB-004 missing alt | No decorative images; any future image must pass the checklist in `tests/a11y/` |
| WEB-005 no landmarks, empty headings | Skip link, `<header>`, `<nav aria-label>`, `<main>`, and a clean `h1` → `h2` heading order |
| Duplicate ids (found in WEB-001) | Every `id` in `client/index.html` is unique and used for label/hint/error linking |
