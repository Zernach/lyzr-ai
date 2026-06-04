import type { UnderwriteResponse } from "./api";

const SUBAGENT_ORDER = [
  "Credit Risk",
  "Income and Affordability",
  "Vehicle and Loan-to-Value",
  "Policy Match",
  "Fair Lending and Compliance",
  "Manual Review Need",
];

/** Renders the orchestrator's structured recommendation. Used in the Create
 *  modal and in an applicant's detail drawer. */
export default function UnderwriteResult({
  result,
}: {
  result: UnderwriteResponse;
}) {
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
        <ListCard title="Key Risk Factors" items={result.key_risk_factors} variant="risk" />
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
            {SUBAGENT_ORDER.filter((k) => result.subagent_findings[k]).map((k) => (
              <div key={k} className="finding">
                <div className="finding-head">{k}</div>
                <div className="finding-body">{result.subagent_findings[k]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="disclaimer">
        This is an underwriting-support recommendation only. Final credit decisions
        must be made through the company&rsquo;s approved underwriting process and
        applicable compliance review.
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
