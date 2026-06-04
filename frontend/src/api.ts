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

interface JobStatusResponse {
  status: "pending" | "running" | "done" | "error";
  result?: UnderwriteResponse;
  detail?: string;
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 600; // ~20 minutes

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
  /** Fired with the job id as soon as the run is accepted (202). */
  onJobStarted?: (jobId: string) => void;
}

export async function underwrite(
  rules: string,
  applicant: string,
  opts: UnderwriteOptions = {}
): Promise<UnderwriteResponse> {
  const startRes = await fetch(`${BACKEND_URL}/api/underwrite`, {
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

  if (!startRes.ok) {
    throw new Error(await readDetail(startRes, `Request failed (${startRes.status})`));
  }

  const { job_id } = (await startRes.json()) as StartJobResponse;
  opts.onJobStarted?.(job_id);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(`${BACKEND_URL}/api/jobs/${job_id}`);
    if (!pollRes.ok) {
      if (pollRes.status === 404) {
        throw new Error("Job expired before completing.");
      }
      // 5xx / transient — keep polling
      continue;
    }

    const body = (await pollRes.json()) as JobStatusResponse;
    if (body.status === "done" && body.result) {
      return body.result;
    }
    if (body.status === "error") {
      throw new Error(body.detail || "Underwriting job failed.");
    }
    // pending | running — keep polling
  }

  throw new Error("Timed out waiting for underwriting result.");
}
