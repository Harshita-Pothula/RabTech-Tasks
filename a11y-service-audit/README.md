# Accessibility Baseline & Repository Architecture Audit

An accessibility audit of a real public service website (Passport Seva, passportindia.gov.in), and an accessible full-stack project skeleton built from what the audit taught us.

- **Audit report:** [`docs/audit/audit-report.md`](docs/audit/audit-report.md)
- **Issue log (CSV):** [`docs/audit/accessibility-audit.csv`](docs/audit/accessibility-audit.csv)
- **Screenshots:** [`docs/audit/screenshots/`](docs/audit/screenshots/)

## Architecture tree

```
a11y-service-audit/
├── client/                  # Front end: static HTML, CSS, JS (no build step)
│   ├── index.html
│   └── src/
│       ├── main.js          # Form handling, calls /api
│       └── styles.css       # Focus styles, contrast, reduced motion
├── server/                  # Back end: Node + Express
│   └── src/
│       ├── app.js           # Wires routes and serves client/
│       ├── index.js         # Starts the server
│       └── routes/
│           └── status.js    # GET /api/status/:fileNumber
├── tests/
│   ├── server/              # API tests (node:test, no extra deps)
│   └── a11y/                # Manual keyboard checklist
├── docs/
│   ├── audit/               # Audit report, CSV, screenshots
│   └── decisions/           # Architecture decision records
├── .env.example
└── package.json             # npm workspaces root
```

## Boundaries

| Layer | Owns | Must not |
|-------|------|----------|
| `client/` | Markup, styles, user interaction, accessibility of the UI | Hold business rules or data |
| `server/` | Validation, data access, JSON responses under `/api` | Return HTML or depend on client code |
| `tests/` | Checks across both layers | Be imported by app code |
| `docs/` | Audit evidence and decisions | Contain runnable code |

The client talks to the server only through `/api/*`. The server validates everything itself, even if the client already did, so either side can be replaced on its own.

## Local setup

Requires Node.js 20 or later.

```bash
git clone <your-repo-url>
cd a11y-service-audit
npm install
cp .env.example .env        # optional, default port is 3000
npm run dev                 # open http://localhost:3000
npm test                    # runs API tests
```

Try file numbers `HYD1234567` or `HYD7654321`. Anything else shows an error.

## First vertical feature slice: check application status

One feature, built through every layer, so the structure is proven end to end.

1. **UI** (`client/index.html`): labelled input with a hint, visible focus, skip link, one clear button.
2. **Client logic** (`client/src/main.js`): on submit, calls the API. Errors are shown next to the field, linked with `aria-describedby`, and focus moves back to the input. Results are announced through an `aria-live` region.
3. **API** (`server/src/routes/status.js`): validates the format, returns `200`, `400` or `404` with a plain-language message.
4. **Tests** (`tests/server/status.test.js`): cover success, bad format and not found. `tests/a11y/keyboard-checklist.md` covers the manual keyboard pass.

This slice deliberately fixes the problems found in the audit. See section 5 of the audit report.

## Next slices

- Replace mock data with a database
- Add automated accessibility checks (axe-core) to `npm test`
- Add CI to run tests on every push
