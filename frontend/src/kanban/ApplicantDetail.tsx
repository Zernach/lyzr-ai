import { useEffect, useMemo, useState } from "react";
import { underwrite, type UnderwriteResponse } from "../api";
import {
  deleteApplicant,
  getJobResult,
  setApplicantStage,
  stageForDecision,
  updateApplicant,
} from "../db";
import { avatarColor, dtiPct, initials, ltvPct, money } from "../format";
import {
  STAGES,
  STAGE_BY_KEY,
  type Applicant,
  type Role,
  type Stage,
  type UnderwritingRule,
} from "../types";
import UnderwriteResult from "../UnderwriteResult";

interface Props {
  applicant: Applicant;
  role: Role;
  uid: string;
  rules: UnderwritingRule[];
  onClose: () => void;
}

export default function ApplicantDetail({ applicant: a, role, uid, rules, onClose }: Props) {
  const isUnderwriter = role === "underwriter";

  const defaultRule =
    rules.find((r) => r.id === a.rulesId) ??
    rules.find((r) => r.isDefault) ??
    rules[0];
  const [selectedRuleId, setSelectedRuleId] = useState(defaultRule?.id ?? "");
  const [rulesText, setRulesText] = useState(defaultRule?.body ?? "");

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnderwriteResponse | null>(null);
  const [loadingPrior, setLoadingPrior] = useState(false);

  const accent = STAGE_BY_KEY[a.stage]?.accent ?? "#7DEBFF";
  const dti = dtiPct(a);
  const ltv = ltvPct(a);

  // Pull the full prior result (subagent findings) if a job already ran.
  useEffect(() => {
    let alive = true;
    if (a.latestJobId) {
      setLoadingPrior(true);
      getJobResult(a.latestJobId)
        .then((r) => {
          if (alive && r) setResult(r as UnderwriteResponse);
        })
        .catch(() => {})
        .finally(() => alive && setLoadingPrior(false));
    }
    return () => {
      alive = false;
    };
  }, [a.latestJobId]);

  const onPickRule = (id: string) => {
    setSelectedRuleId(id);
    const r = rules.find((x) => x.id === id);
    if (r) setRulesText(r.body);
  };

  const moveTo = async (stage: Stage) => {
    try {
      await setApplicantStage(a.id, stage);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRun = async () => {
    setError(null);
    setResult(null);
    if (!rulesText.trim()) return setError("Select or paste underwriting rules first.");
    if (!a.applicantData.trim()) return setError("This applicant has no data to evaluate.");
    setRunning(true);
    try {
      await setApplicantStage(a.id, "underwriting");
      const res = await underwrite(rulesText, a.applicantData, {
        applicantId: a.id,
        rulesId: selectedRuleId || undefined,
        createdBy: uid,
        onJobStarted: (jobId) => void updateApplicant(a.id, { latestJobId: jobId }),
      });
      setResult(res);
      await updateApplicant(a.id, {
        decision: res.decision,
        decisionStatus: res.status,
        decisionSummary: res.summary,
        stage: stageForDecision(res.decision, res.status),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void updateApplicant(a.id, { stage: "manual_review" });
    } finally {
      setRunning(false);
    }
  };

  const onDelete = async () => {
    if (!confirm(`Delete ${a.fullName}'s card? This can't be undone.`)) return;
    try {
      await deleteApplicant(a.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const vehicle = useMemo(
    () => [a.vehicle?.year, a.vehicle?.make, a.vehicle?.model].filter(Boolean).join(" "),
    [a.vehicle]
  );

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--rail" as string]: accent }}
      >
        <header className="drawer-head">
          <div className="drawer-id">
            <span className="kcard-avatar lg" style={{ ["--av" as string]: avatarColor(a.fullName) }}>
              {initials(a.fullName)}
            </span>
            <div>
              <div className="drawer-name">{a.fullName}</div>
              <div className="drawer-sub">
                {a.email || "no email"} {a.phone ? `· ${a.phone}` : ""}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="drawer-body">
          <div className="stage-badge" style={{ ["--rail" as string]: accent }}>
            <span className="stage-dot" />
            {STAGE_BY_KEY[a.stage]?.label ?? a.stage}
            {a.decision && (
              <span className={`tag tag-decision ${a.decision === "YES" ? "yes" : "no"}`}>
                {a.decision}
              </span>
            )}
          </div>

          <div className="stat-grid">
            <Stat label="Credit score" value={a.creditScore?.toString() ?? "—"} />
            <Stat label="Requested" value={money(a.requestedAmount)} />
            <Stat label="Down payment" value={money(a.downPayment)} />
            <Stat label="Monthly income" value={money(a.monthlyIncome)} />
            <Stat label="Monthly debt" value={money(a.monthlyDebt)} />
            <Stat label="Est. payment" value={a.estimatedMonthlyPayment ? `${money(a.estimatedMonthlyPayment)}/mo` : "—"} />
            <Stat label="Term" value={a.loanTermMonths ? `${a.loanTermMonths} mo` : "—"} />
            <Stat label="APR" value={a.estimatedApr ? `${a.estimatedApr}%` : "—"} />
            <Stat label="DTI" value={dti !== undefined ? `${dti}%` : "—"} />
            <Stat label="LTV" value={ltv !== undefined ? `${ltv}%` : "—"} />
          </div>

          {vehicle && (
            <div className="drawer-line">
              <span>Vehicle</span>
              <strong>
                {vehicle}
                {a.vehicle?.mileage ? ` · ${a.vehicle.mileage.toLocaleString()} mi` : ""}
                {a.vehicle?.value ? ` · ${money(a.vehicle.value)}` : ""}
              </strong>
            </div>
          )}

          {isUnderwriter && (
            <div className="drawer-section">
              <div className="panel-title" style={{ marginBottom: 10 }}>
                <span className="panel-title-bar" />
                Move to stage
              </div>
              <div className="stage-move">
                {STAGES.map((s) => (
                  <button
                    key={s.key}
                    className={`stage-chip ${a.stage === s.key ? "is-active" : ""}`}
                    style={{ ["--rail" as string]: s.accent }}
                    onClick={() => moveTo(s.key)}
                    disabled={a.stage === s.key}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isUnderwriter && (
            <div className="drawer-section">
              <div className="panel-title" style={{ marginBottom: 10 }}>
                <span className="panel-title-bar" />
                Run the agent crew
              </div>
              <select className="rule-select" value={selectedRuleId} onChange={(e) => onPickRule(e.target.value)}>
                {rules.length === 0 && <option value="">No presets yet</option>}
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.isDefault ? "  ·  default" : ""}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary drawer-run" onClick={onRun} disabled={running}>
                {running ? "Routing through subagents…" : result ? "Re-run underwriting" : "Run underwriting"}
              </button>
            </div>
          )}

          <details className="raw drawer-data">
            <summary>Applicant data sent to the agent</summary>
            <pre>{a.applicantData || "(empty)"}</pre>
          </details>

          {running && (
            <div className="loading">
              <div className="loading-pulse" />
              <div className="loading-text">
                <strong>Orchestrating the underwriting crew…</strong>
                <span>Credit · Affordability · Collateral · Policy · Fair Lending · Escalation</span>
              </div>
            </div>
          )}

          {error && (
            <div className="error">
              <strong>Error</strong>
              {error}
            </div>
          )}

          {loadingPrior && !result && (
            <div className="drawer-loading-prior">Loading previous result…</div>
          )}

          {result && <UnderwriteResult result={result} />}

          {!result && !running && a.decisionSummary && (
            <div className="next-step" style={{ marginTop: 18 }}>
              <strong>Latest decision · {a.decisionStatus}</strong>
              {a.decisionSummary}
            </div>
          )}

          {isUnderwriter && (
            <button className="btn btn-ghost drawer-delete" onClick={onDelete}>
              Delete card
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
