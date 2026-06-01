# Frontend — Lyzr Underwriting Copilot

Vite + React + TypeScript dashboard with a dark-arctic theme. Drives the
FastAPI backend at `/api/underwrite` (proxied to `localhost:8000` in dev).

## Setup

```bash
cd frontend
npm install
npm run dev
```

## Dependency policy (security hardening)

Do NOT install any npm package version published less than 7 days ago.
Compromised supply-chain releases are usually yanked within a week, so we
quarantine new versions. Before adding/upgrading a dependency:

```bash
npm view <pkg> time.<version>   # confirm the release date is ≥ 7 days old
```

If the latest version is too new, pin to the newest version that clears the
7-day window. Use exact pins (no `^`/`~`/`>=`) so resolution can't drift into
the quarantine window.

Visit <http://localhost:5173>. The dev server proxies `/api/*` to the
FastAPI backend on port 8000 — start the backend first (see
`../backend/README.md`).

## Theme

- Base: `#1c1c1c` with layered radial gradients
- Accent: arctic cyan `#7DEBFF` for glows, focus rings, decision chrome
- Verdicts: emerald `#38f5a4` for YES, coral `#ff5b6b` for NO
