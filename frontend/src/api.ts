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

export async function underwrite(
  rules: string,
  applicant: string
): Promise<UnderwriteResponse> {
  const res = await fetch("/api/underwrite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules, applicant }),
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return res.json();
}
