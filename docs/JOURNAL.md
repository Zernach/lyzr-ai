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
