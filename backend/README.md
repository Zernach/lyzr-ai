# Backend — Auto-Loan Underwriting Copilot

FastAPI service that wraps the Lyzr ADK auto-loan orchestrator agent.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # already created — edit if needed
uvicorn main:app --reload --port 8000
```

## Dependency policy (security hardening)

Do NOT install any PyPI package version published less than 7 days ago.
Compromised supply-chain releases are usually yanked within a week, so we
quarantine new versions. Before adding/upgrading a dependency:

```bash
pip index versions <pkg>
curl -s https://pypi.org/pypi/<pkg>/<version>/json | jq '.urls[].upload_time'
# confirm the upload_time is ≥ 7 days old
```

If the latest version is too new, pin to the newest version that clears the
7-day window. Use exact pins (`==`) instead of `>=`/`~=` so resolution can't
drift into the quarantine window.

Health check: <http://localhost:8000/api/health>

## API

`POST /api/underwrite`

```json
{
  "rules": "…pasted underwriting rules…",
  "applicant": "…pasted applicant data…"
}
```

Returns a parsed orchestrator recommendation with a binary `decision`
(`YES` for Preliminary/Conditional Approve, `NO` otherwise), plus the
full structured breakdown.
