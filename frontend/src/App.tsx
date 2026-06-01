import { useState } from "react";
import { underwrite, type UnderwriteResponse } from "./api";
import { SAMPLE_APPLICANT, SAMPLE_RULES } from "./samples";

const SUBAGENT_ORDER = [
  "Credit Risk",
  "Income and Affordability",
  "Vehicle and Loan-to-Value",
  "Policy Match",
  "Fair Lending and Compliance",
  "Manual Review Need",
];

export default function App() {
  const [rules, setRules] = useState("");
  const [applicant, setApplicant] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnderwriteResponse | null>(null);

  const canSubmit = rules.trim().length > 0 && applicant.trim().length > 0 && !loading;

  const onSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await underwrite(rules, applicant);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setRules(SAMPLE_RULES);
    setApplicant(SAMPLE_APPLICANT);
  };

  const clearAll = () => {
    setRules("");
    setApplicant("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/lyzr-icon.png" alt="Lyzr" />
          <div>
            <div className="brand-title">Lyzr Underwriting Copilot</div>
            <div className="brand-sub">Auto Loan · Agentic Decision Support</div>
          </div>
        </div>
        <div className="status-chip">
          <span className="status-dot" />
          Lyzr ADK Orchestrator
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1>
            Underwriting,{" "}
            <span className="glow">accelerated by an agent crew.</span>
          </h1>
          <p>
            Paste your policy and the applicant&rsquo;s data. The orchestrator
            routes the case through credit, affordability, collateral,
            compliance, and escalation subagents — then returns a structured
            recommendation in seconds.
          </p>
        </section>

        <section className="grid">
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="panel-title-bar" />
                Underwriting Rules &amp; Guidelines
              </div>
              <div className="panel-sub">{rules.length.toLocaleString()} chars</div>
            </div>
            <div className="field-label">
              <span>Paste your policy, thresholds, and program limits.</span>
            </div>
            <textarea
              className="input"
              placeholder="e.g. Credit score 740+: strong profile&#10;Max front-end PTI: 15%&#10;Max DTI after proposed auto loan: 50%&#10;Max LTV for used vehicles: 110%…"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              spellCheck={false}
            />
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">
                <span className="panel-title-bar" />
                Applicant Data
              </div>
              <div className="panel-sub">{applicant.length.toLocaleString()} chars</div>
            </div>
            <div className="field-label">
              <span>Credit, income, vehicle, loan structure, history.</span>
            </div>
            <textarea
              className="input"
              placeholder="e.g. Credit score: 642&#10;Monthly gross income: $5,200&#10;Existing monthly debt: $2,050&#10;Requested loan amount: $28,000…"
              value={applicant}
              onChange={(e) => setApplicant(e.target.value)}
              spellCheck={false}
            />
          </div>
        </section>

        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={onSubmit}
            disabled={!canSubmit}
          >
            {loading ? "Routing through subagents…" : "Run Underwriting Review"}
          </button>
          <button className="btn" onClick={loadSample} disabled={loading}>
            Load sample case
          </button>
          <button className="btn btn-ghost" onClick={clearAll} disabled={loading}>
            Clear
          </button>
        </div>

        {loading && (
          <div className="loading">
            <div className="loading-pulse" />
            <div className="loading-text">
              <strong>Orchestrating the underwriting crew…</strong>
              <span>
                Credit · Affordability · Collateral · Policy · Fair Lending ·
                Escalation
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="error">
            <strong>Request failed</strong>
            {error}
          </div>
        )}

        {!loading && !error && !result && (
          <div className="empty-state">
            <div className="glyph">❋</div>
            <div>
              Submit a case to see the orchestrator&rsquo;s structured
              recommendation.
            </div>
          </div>
        )}

        {result && <Result result={result} />}
      </main>
    </div>
  );
}

function Result({ result }: { result: UnderwriteResponse }) {
  const isYes = result.decision === "YES";

  return (
    <section className="result-section">
      <div className={`verdict ${isYes ? "verdict-yes" : "verdict-no"}`}>
        <div className="verdict-badge">
          <div className="verdict-symbol">{result.decision}</div>
          <div className="verdict-status">
            Orchestrator status
            <strong>{result.status}</strong>
          </div>
        </div>
        <div className="verdict-body">
          <h3>Summary</h3>
          <p>{result.summary || "No summary provided."}</p>
          {result.recommended_next_step && (
            <div className="next-step">
              <strong>Recommended next step</strong>
              {result.recommended_next_step}
            </div>
          )}
        </div>
      </div>

      <div className="cards">
        <ListCard
          title="Key Risk Factors"
          items={result.key_risk_factors}
          variant="risk"
        />
        <ListCard
          title="Compensating Factors"
          items={result.compensating_factors}
          variant="comp"
        />
        <ListCard
          title="Missing Information"
          items={result.missing_information}
          variant="missing"
        />
        <ListCard
          title="Adverse Action Reasons"
          items={result.adverse_action_reasons}
          variant=""
          emptyLabel={
            isYes
              ? "Not applicable — no adverse action."
              : "None returned by the subagent."
          }
        />
      </div>

      {Object.keys(result.subagent_findings).length > 0 && (
        <div className="findings">
          <div className="panel-title" style={{ marginBottom: 12 }}>
            <span className="panel-title-bar" />
            Subagent Findings
          </div>
          <div className="findings-grid">
            {SUBAGENT_ORDER.filter(
              (k) => result.subagent_findings[k]
            ).map((k) => (
              <div key={k} className="finding">
                <div className="finding-head">{k}</div>
                <div className="finding-body">{result.subagent_findings[k]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="disclaimer">
        This is an underwriting-support recommendation only. Final credit
        decisions must be made through the company&rsquo;s approved underwriting
        process and applicable compliance review.
      </div>

      <details className="raw">
        <summary>View raw orchestrator response</summary>
        <pre>{result.raw_response}</pre>
      </details>
    </section>
  );
}

function ListCard({
  title,
  items,
  variant,
  emptyLabel,
}: {
  title: string;
  items: string[];
  variant: "risk" | "comp" | "missing" | "";
  emptyLabel?: string;
}) {
  const className = `card${variant ? ` card-${variant}` : ""}`;
  return (
    <div className={className}>
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      ) : (
        <div className="empty">{emptyLabel || "None reported."}</div>
      )}
    </div>
  );
}
