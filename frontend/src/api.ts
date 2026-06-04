import { BACKEND_URL } from "./config";
import { createJob } from "./db";

export interface UnderwriteResponse {
  decision: "YES" | "NO";
  status: string;
  summary: string;
  subagent_findings: Record<string, string>;
  missing_information: string[];
  key_risk_factors: string[];
  compensating_factors: string[];
  adverse_action_reasons: string[];
  recommended_next_step: string;
  raw_response: string;
}

interface StartJobResponse {
  job_id: string;
  status: string;
}

async function readDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (body?.detail) return String(body.detail);
  } catch {
    // ignore
  }
  return fallback;
}

export interface UnderwriteOptions {
  /** Link the job back to a kanban card so the backend can move it on finish. */
  applicantId?: string;
  /** Rule preset used (stored on the job for auditing). */
  rulesId?: string;
  /** uid of whoever kicked off the run. */
  createdBy?: string;
}

/**
 * Begin an underwriting run and return its job id.
 *
 * Primary path writes the `pending` job doc straight to Firestore from the
 * browser (`createJob`) — no backend hop, so a server that can't reach
 * Firestore can't stall the launch (that was the 60s `POST /api/underwrite`
 * hang). If the direct write is somehow blocked (e.g. rules not yet deployed),
 * we fall back to the backend POST. Either way the Firestore-triggered
 * `process_job` runs the crew and `listenJob` streams the result to the UI.
 */
export async function beginUnderwriting(
  rules: string,
  applicant: string,
  opts: UnderwriteOptions = {}
): Promise<string> {
  try {
    return await createJob({
      rules,
      applicant,
      applicantId: opts.applicantId,
      rulesId: opts.rulesId,
      createdBy: opts.createdBy,
    });
  } catch (directErr) {
    try {
      return await startUnderwrite(rules, applicant, opts);
    } catch {
      // Surface the original (direct-write) error — it's the more actionable one.
      throw directErr instanceof Error ? directErr : new Error(String(directErr));
    }
  }
}

const POST_TIMEOUT_MS = 15000;
const POST_RETRIES = 2;

/**
 * Fallback launcher: POST the case to the backend, which writes the pending
 * job doc. Hardened so it never hangs — each attempt is aborted after
 * POST_TIMEOUT_MS, and transient network/5xx failures are retried with backoff
 * (4xx are surfaced immediately).
 */
export async function startUnderwrite(
  rules: string,
  applicant: string,
  opts: UnderwriteOptions = {}
): Promise<string> {
  const body = JSON.stringify({
    rules,
    applicant,
    applicant_id: opts.applicantId,
    rules_id: opts.rulesId,
    created_by: opts.createdBy,
  });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= POST_RETRIES; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 600 * attempt));

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/api/underwrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      lastErr = ctrl.signal.aborted ? new Error("The server took too long to respond.") : e;
      continue; // network error / timeout → retry
    }
    clearTimeout(timer);

    if (res.ok) {
      const { job_id } = (await res.json()) as StartJobResponse;
      if (!job_id) throw new Error("Backend did not return a job id.");
      return job_id;
    }

    const detail = await readDetail(res, `Request failed (${res.status})`);
    if (res.status < 500) throw new Error(detail); // client error — don't retry
    lastErr = new Error(detail); // server error — retry
  }

  throw lastErr instanceof Error ? lastErr : new Error("Could not start the underwriting run.");
}
