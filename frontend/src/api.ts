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

type StreamEvent =
  | { event: "heartbeat" }
  | { event: "result"; data: UnderwriteResponse }
  | { event: "error"; status?: number; detail?: string };

export async function underwrite(
  rules: string,
  applicant: string
): Promise<UnderwriteResponse> {
  const res = await fetch(`${BACKEND_URL}/api/underwrite`, {
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

  if (!res.body) {
    throw new Error("Empty response body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let evt: StreamEvent;
        try {
          evt = JSON.parse(line) as StreamEvent;
        } catch {
          continue;
        }
        if (evt.event === "heartbeat") continue;
        if (evt.event === "result") return evt.data;
        if (evt.event === "error") {
          throw new Error(evt.detail || `Request failed (${evt.status ?? 500})`);
        }
      }
    }
    if (done) break;
  }
  throw new Error("Stream ended without a result");
}
