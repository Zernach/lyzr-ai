# Journal of Prompts

| Prompt                                                                              | Timestamp               | Time Elapsed | Token Cost |
| ----------------------------------------------------------------------------------- | ----------------------- | ------------ | ---------- |
| Create blank JOURNAL table with Prompt, Timestamp, Time Elapsed, Token Cost columns | 2026-05-27 08:55:00 MDT | 15s          | 2800       |
| Bootstrap dashboard: FastAPI backend + Vite/React dark-arctic frontend wired to Lyzr ADK orchestrator | 2026-06-01 15:55:10 MDT | 480s         | 78000      |
| Write start.sh to launch backend, frontend, and open the dashboard in the browser | 2026-06-01 15:58:00 MDT | 90s          | 9500       |
| Fix start.sh: prefer python3.13 over 3.14, recreate stale venvs, use prefer-binary pip, real ANSI escapes | 2026-06-01 16:02:41 MDT | 150s         | 13500      |
| Switch backend from raw HTTP to lyzr-adk SDK (Studio.get_agent → agent.run, cached, async via to_thread) | 2026-06-01 16:04:44 MDT | 180s         | 15500      |
| Fix start.sh: robust venv creation — fall back to --without-pip + get-pip.py and try multiple Python versions | 2026-06-01 16:12:47 MDT | 120s         | 11000      |
| Finish wrangler setup in frontend for Cloudflare Pages deploy (wrangler.jsonc, _redirects SPA fallback, pin wrangler dep, ignore .wrangler) | 2026-06-01 16:15:28 MDT | 180s         | 22000      |
| Add 7-day quarantine rule for npm/PyPI installs in frontend & backend (CLAUDE.md, AGENTS.md, both READMEs) | 2026-06-01 16:18:17 MDT | 90s          | 14000      |
| Add Pages Function at functions/api/[[path]].ts to proxy /api/* to BACKEND_URL env var, wire var into wrangler.jsonc | 2026-06-01 16:19:20 MDT | 90s          | 17000      |
| Create scripts/lyzr.sh — interactive arrow-key menu with cyan selector for start / deploy-frontend / deploy-backend / deploy-both | 2026-06-01 16:24:30 MDT | 180s         | 28000      |
| Set up Firebase Functions deploy for FastAPI backend: root package.json pins firebase-tools@15.18.0, firebase/main.py wraps FastAPI via a2wsgi, firebase.json + .firebaserc (project lyzr-ai-demo), scripts/deploy_backend.sh stages backend+generates requirements+deploys | 2026-06-01 16:39:23 MDT | 480s         | 62000      |
| Use yarn (not npm) for frontend in scripts/start.sh; fix ROOT_DIR to repo root | 2026-06-01 16:48:20 MDT | 45s          | 4200       |
| interactive.sh: no default cursor/highlight on startup; start not pre-focused until arrow keys | 2026-06-01 17:05:00 MDT | 60s          | 8500       |
| Fix interactive menu: ←/→ move (not toggle); single-select; Enter runs one command only | 2026-06-01 16:55:23 MDT | 90s          | 7200       |
| Undo previous commit; squash staged fixes; force push main | 2026-06-01 17:10:00 MDT | 30s          | 3500       |
| deploy_backend.sh: build firebase/venv (python3.12, cached by deps-hash) so Firebase CLI source analysis can locate firebase-functions SDK | 2026-06-01 16:57:34 MDT | 120s         | 14500      |
| Add frontend/src/config.ts with ENV flag (local | dev) selecting BACKEND_URL (localhost:8000 vs https://lyzr-ai-demo.web.app); api.ts now calls ${BACKEND_URL}/api/underwrite | 2026-06-01 17:13:02 MDT | 90s          | 13500      |
| firebase/main.py: configure CorsOptions on api fn (lyzr-ai-demo.web.app, .firebaseapp.com, http://localhost:5173) so preflights succeed through Hosting rewrite | 2026-06-01 17:18:00 MDT | 60s          | 9500       |
| Fix deploy-frontend Permission denied: write minimal scripts/deploy_frontend.sh (yarn build && wrangler pages deploy --commit-dirty=true) and chmod +x | 2026-06-01 17:21:43 MDT | 150s         | 14000      |
| Simplify deploy_frontend.sh to cd into frontend/ and run `yarn deploy` (single source of truth in frontend/package.json) | 2026-06-01 17:23:58 MDT | 30s          | 3500       |
| Use frontend/public/lyzr-icon.{ico,png} as favicon/apple-touch-icon in index.html (replaces vite.svg) | 2026-06-01 17:29:35 MDT | 25s          | 4500       |
| Swap header brand-mark gradient for <img src="/lyzr-icon.png"> next to title; strip background gradient in .brand-mark CSS | 2026-06-01 17:31:10 MDT | 35s          | 5200       |
| Diagnose CORS error from lyzr.pages.dev → /api/underwrite: real cause is Firebase Hosting's 60s rewrite timeout returning a CORS-less 502, not the allowlist (already includes lyzr.pages.dev). Fix: frontend/src/config.ts dev → "" so api.ts hits relative /api/* via the Cloudflare Pages proxy; wrangler.jsonc BACKEND_URL → https://api-cvcqkzsqeq-uc.a.run.app (direct Cloud Run, 120s timeout, no Hosting cap, no browser CORS) | 2026-06-01 17:46:53 MDT | 380s         | 42000      |
| Diagnose lyzr-adk websocket/firebase questions: SDK has no WS, only SSE (Inference.stream/astream + run(stream=True)); Firebase Functions/Hosting have no WS upgrade either. Real bottleneck is the 120s underwrite call. Bump firebase/main.py timeout_sec 120→3600 and backend Studio(timeout=180→3600) so both layers permit the full agent run | 2026-06-01 17:55:01 MDT | 360s         | 38000      |
| Point frontend BACKEND_URL at https://api.lyzr.archlife.org/ (config.ts dev value) | 2026-06-01 18:02:00 MDT | 20s          | 3200       |
