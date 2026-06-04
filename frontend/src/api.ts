import { BACKEND_URL } from "./config";

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
 * Kick off an underwriting run and return the job id immediately.
 *
 * The only backend HTTP call in the whole flow: it POSTs the case, the backend
 * writes a `pending` job doc and returns. From there the agent crew runs
 * server-side in the `process_job` Cloud Function (up to ~9 min) and writes its
 * status + result back onto `underwriting_jobs/{jobId}`. The client watches
 * that doc live via `listenJob` (see UnderwritingProgress) — no long-lived HTTP
 * poll that could 500 mid-run.
 */
export async function startUnderwrite(
  rules: string,
  applicant: string,
  opts: UnderwriteOptions = {}
): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/underwrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rules,
      applicant,
      applicant_id: opts.applicantId,
      rules_id: opts.rulesId,
      created_by: opts.createdBy,
    }),
  });

  if (!res.ok) {
    throw new Error(await readDetail(res, `Request failed (${res.status})`));
  }

  const { job_id } = (await res.json()) as StartJobResponse;
  if (!job_id) throw new Error("Backend did not return a job id.");
  return job_id;
}
