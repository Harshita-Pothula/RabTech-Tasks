# 0001: Monorepo with npm workspaces

**Status:** Accepted
**Date:** 27 Sep 2026

## Context

The project needs a front end, a back end, tests and audit documentation that stay in step with each other. Keeping them in separate repositories would make it easy for the API and the UI to drift apart.

## Decision

Use a single repository with npm workspaces: `client/` and `server/` are separate packages, `tests/` and `docs/` sit alongside them. The client is plain HTML, CSS and JS with no build step, served as static files by the Express server. The two talk only through `/api/*`.

## Consequences

- One `npm install` and one `npm test` for the whole project.
- Clear boundary: the client never imports server code, so either side can be replaced later (for example, swapping the client for React).
- No build step keeps setup simple, at the cost of no bundling or TypeScript for now.
