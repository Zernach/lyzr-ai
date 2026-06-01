IMPORTANT: After completing the user's request, always add a row to the ./docs/JOURNAL.md file with four columns:

- **Prompt** — Brief summary of the user request
- **Timestamp** — Date and time when recorded (e.g. `2026-05-27 09:02:44 MDT`). Must include time, not date alone.
- **Time Elapsed** — Seconds to complete the prompt (e.g. `42s`)
- **Token Cost** — Total tokens for the turn (input + output), as a number (e.g. `12450`)

IMPORTANT (security hardening): In both `frontend/` and `backend/`, do NOT install npm or PyPI package versions that were published less than 7 days ago. Compromised supply-chain releases are usually yanked within a week, so a 7-day quarantine reduces exposure. Before adding or upgrading a dependency:

- npm: `npm view <pkg> time.<version>` (or `time.modified`) and confirm it is ≥ 7 days old.
- PyPI: `pip index versions <pkg>` plus `https://pypi.org/pypi/<pkg>/<version>/json` (`.urls[].upload_time`) and confirm it is ≥ 7 days old.
- If the latest version is too new, pin to the most recent version that is ≥ 7 days old. Never use floating ranges (`^`, `~`, `>=`) that could resolve into the quarantine window — pin exact versions.
