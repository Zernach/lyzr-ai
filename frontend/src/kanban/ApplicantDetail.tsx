import { useEffect, useMemo, useRef, useState } from "react";
import { beginUnderwriting, type UnderwriteResponse } from "../api";
import {
  deleteApplicant,
  getJobResult,
  setApplicantStage,
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
import UnderwritingProgress from "../UnderwritingProgress";

interface Props {
  applicant: Applicant;
  role: Role;
  uid: string;
  rules: UnderwritingRule[];
  /** A run already kicked off elsewhere (the Create modal handoff): show its
   *  live crew console immediately and scroll down to it. */
  initialJobId?: string | null;
  onClose: () => void;
}

export default function ApplicantDetail({
  applicant: a,
  role,
  uid,
  rules,
  initialJobId,
  onClose,
}: Props) {
  const isUnderwriter = role === "underwriter";

  const defaultRule =
    rules.find((r) => r.id === a.rulesId) ??
    rules.find((r) => r.isDefault) ??
    rules[0];
  const [selectedRuleId, setSelectedRuleId] = useState(defaultRule?.id ?? "");
  const [rulesText, setRulesText] = useState(defaultRule?.body ?? "");

  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(initialJobId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnderwriteResponse | null>(null);
  const [loadingPrior, setLoadingPrior] = useState(false);

  const busy = running || jobId !== null;

  // Smooth-scroll the drawer down to the live crew console when a run is handed
  // in from the Create modal (or started here). We animate scrollTop by hand
  // (driven off performance.now via a short interval) rather than leaning on
  // scrollIntoView({behavior:"smooth"}) — native smooth scroll is silently
  // dropped in some environments (headless, mid-layout) — so a manual tween
  // guarantees the move actually happens. Reduced-motion users just jump.
  const progressRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!jobId) return;
    let tween: ReturnType<typeof setInterval> | undefined;
    const startTimer = setTimeout(() => {
      const el = progressRef.current;
      const container = el?.closest(".drawer-body") as HTMLElement | null;
      if (!el || !container) return;
      const target = Math.max(
        0,
        container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top - 12
      );
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        container.scrollTop = target;
        return;
      }
      const from = container.scrollTop;
      const dist = target - from;
      const dur = 560;
      const t0 = performance.now();
      tween = setInterval(() => {
        const p = Math.min((performance.now() - t0) / dur, 1);
        container.scrollTop = from + dist * (1 - Math.pow(1 - p, 3)); // easeOutCubic
        if (p >= 1 && tween) clearInterval(tween);
      }, 16);
    }, 360); // let the drawer's slide-in settle first
    return () => {
      clearTimeout(startTimer);
      if (tween) clearInterval(tween);
    };
  }, [jobId]);

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

  // Only START the run here; the live progress view watches the Firestore job
  // doc to completion. The backend's process_job mirrors decision + stage onto
  // the card via the Admin SDK (the board's listener reflects it), so we don't
  // write those back from the client.
  const onRun = async () => {
    setError(null);
    setResult(null);
    if (!rulesText.trim()) return setError("Select or paste underwriting rules first.");
    if (!a.applicantData.trim()) return setError("This applicant has no data to evaluate.");
    setRunning(true);
    try {
      await setApplicantStage(a.id, "underwriting");
      const jid = await beginUnderwriting(rulesText, a.applicantData, {
        applicantId: a.id,
        rulesId: selectedRuleId || undefined,
        createdBy: uid,
      });
      void updateApplicant(a.id, { latestJobId: jid });
      setJobId(jid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      void updateApplicant(a.id, { stage: "manual_review" });
    } finally {
      setRunning(false);
    }
  };

  const onProgressDone = (res: UnderwriteResponse) => {
    setJobId(null);
    setResult(res);
  };

  const onProgressError = (message: string) => {
    setJobId(null);
    setError(message);
    // process_job already parks the card in manual_review on a backend failure.
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
              <button className="btn btn-primary drawer-run" onClick={onRun} disabled={busy}>
                {busy ? "Routing through subagents…" : result ? "Re-run underwriting" : "Run underwriting"}
              </button>
            </div>
          )}

          <details className="raw drawer-data">
            <summary>Applicant data sent to the agent</summary>
            <pre>{a.applicantData || "(empty)"}</pre>
          </details>

          {running && !jobId && (
            <div className="loading">
              <div className="loading-pulse" />
              <div className="loading-text">
                <strong>Dispatching the case to the orchestrator…</strong>
                <span>Opening a secure channel to the agent crew</span>
              </div>
            </div>
          )}

          {jobId && !result && (
            <div ref={progressRef}>
              <UnderwritingProgress
                jobId={jobId}
                applicant={a}
                rulesName={rules.find((r) => r.id === selectedRuleId)?.name}
                onDone={onProgressDone}
                onError={onProgressError}
              />
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
