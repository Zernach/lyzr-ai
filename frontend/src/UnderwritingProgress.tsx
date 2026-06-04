import { useEffect, useMemo, useRef, useState } from "react";
import type { UnderwriteResponse } from "./api";
import { listenJob } from "./db";
import { compactMoney, dtiPct, ltvPct, money } from "./format";

// ─────────────────────────────────────────────────────────────────────────
// Futuristic "agent crew" loading view.
//
// What it does for the user: while the Lyzr orchestrator + its subagents grind
// on the case server-side (~4 min), this turns the wait into a live console
// showing the crew working *on their actual numbers*. It is honest about the
// architecture — it does NOT fake the decision. It subscribes to the Firestore
// `underwriting_jobs/{jobId}` doc (written by the backend Cloud Function) and:
//   • drives a choreographed, data-aware timeline of the six subagents, but
//   • only ever reports "ready" when Firestore flips the job to `done`, and
//   • hands the parent the real result via `onDone`, or surfaces `onError`.
//
// Watching Firestore directly (instead of HTTP-polling the backend every 2s)
// is what makes this robust: the long-running poll endpoint could 500 on cold
// starts, but the realtime listener rides the backend's own writes.
// ─────────────────────────────────────────────────────────────────────────

/** Just the loan snapshot the timeline needs for flavor — a loose subset of
 *  Applicant so both the Create modal (form) and the drawer (card) can pass it. */
export interface ProgressApplicant {
  fullName?: string;
  creditScore?: number;
  monthlyIncome?: number;
  monthlyDebt?: number;
  requestedAmount?: number;
  downPayment?: number;
  vehicle?: { year?: number; make?: string; model?: string; mileage?: number; value?: number };
  loanTermMonths?: number;
  estimatedApr?: number;
  estimatedMonthlyPayment?: number;
}

interface Props {
  jobId: string;
  applicant: ProgressApplicant;
  /** Name of the ruleset preset, for the Policy Match lane's flavor. */
  rulesName?: string;
  onDone: (result: UnderwriteResponse) => void;
  onError: (message: string) => void;
}

type Phase = "pending" | "running" | "done" | "error";

// Real orchestrator runs land around the four-minute mark; the timeline eases
// toward (but never reaches) completion over this window, then crawls until
// Firestore confirms `done`.
const EXPECTED_S = 235;
const HARD_TIMEOUT_MS = 12 * 60 * 1000;

interface LaneDef {
  key: string;
  name: string;
  glyph: string;
  blurb: string;
  /** Active window as a fraction of EXPECTED_S. Lanes overlap (parallel crew). */
  start: number;
  end: number;
  /** Rotating console lines while analyzing. */
  logs: string[];
  /** Line shown once the lane settles. */
  doneLabel: string;
  /** The lane that holds at ~complete until the orchestrator truly finishes. */
  trailing?: boolean;
}

function creditTier(score?: number): string | undefined {
  if (!score) return undefined;
  if (score >= 740) return "prime";
  if (score >= 670) return "near-prime";
  if (score >= 580) return "sub-prime";
  return "deep sub-prime";
}

function buildLanes(a: ProgressApplicant, rulesName?: string): LaneDef[] {
  const cs = a.creditScore;
  const tier = creditTier(cs);
  const dti = dtiPct(a);
  const ltv = ltvPct(a);
  const veh = [a.vehicle?.year, a.vehicle?.make, a.vehicle?.model].filter(Boolean).join(" ");
  const pay = a.estimatedMonthlyPayment;
  const apr = a.estimatedApr;
  const term = a.loanTermMonths;
  const mileage = a.vehicle?.mileage;

  return [
    {
      key: "credit",
      name: "Credit Risk",
      glyph: "◈",
      blurb: "Bureau tier, derogatory marks & thin-file checks",
      start: 0.02,
      end: 0.3,
      doneLabel: "Credit profile assessed",
      logs: [
        "Pulling bureau profile…",
        cs && tier ? `Score ${cs} → ${tier} tier` : "Resolving credit tier…",
        "Scanning delinquencies, collections, charge-offs",
        "Applying score-band & thin-file overlays",
      ].filter(Boolean) as string[],
    },
    {
      key: "income",
      name: "Income & Affordability",
      glyph: "▤",
      blurb: "Debt-to-income & payment-to-income vs verified income",
      start: 0.1,
      end: 0.46,
      doneLabel: "Affordability scored",
      logs: [
        a.monthlyIncome ? `Verifying ${money(a.monthlyIncome)}/mo gross income` : "Verifying stated income…",
        dti !== undefined ? `Back-end DTI ≈ ${dti}%` : "Computing debt-to-income…",
        pay ? `Payment-to-income on ${money(pay)}/mo` : "Estimating payment burden…",
        "Running residual-income stress test",
      ].filter(Boolean) as string[],
    },
    {
      key: "collateral",
      name: "Vehicle & Collateral",
      glyph: "⬢",
      blurb: "Valuation, loan-to-value & advance-rate limits",
      start: 0.18,
      end: 0.56,
      doneLabel: "Collateral valued",
      logs: [
        veh ? `Valuing ${veh}` : "Valuing collateral…",
        ltv !== undefined ? `Loan-to-value ≈ ${ltv}%` : "Computing loan-to-value…",
        mileage ? `Mileage adjustment · ${mileage.toLocaleString()} mi` : "Book value vs requested amount",
        "Checking advance-rate / LTV cap",
      ].filter(Boolean) as string[],
    },
    {
      key: "policy",
      name: "Policy Match",
      glyph: "⌗",
      blurb: "Program limits & overlays from your ruleset",
      start: 0.3,
      end: 0.7,
      doneLabel: "Policy matched",
      logs: [
        rulesName ? `Loading “${rulesName}” ruleset` : "Loading underwriting ruleset…",
        "Matching tier, term & amount to program",
        apr ? `Rate-band eligibility · ${apr}% APR` : "Checking rate-band eligibility",
        term ? `Term ${term} mo within program max?` : "Validating term & structure limits",
      ].filter(Boolean) as string[],
    },
    {
      key: "fair",
      name: "Fair Lending & Compliance",
      glyph: "⚖",
      blurb: "ECOA / Reg B fairness & bias guardrails",
      start: 0.42,
      end: 0.82,
      doneLabel: "Compliance cleared",
      logs: [
        "Running ECOA / Reg B fairness pass",
        "Applying disparate-impact guardrails",
        "Scrubbing prohibited-basis signals",
        "Comparing against comparable files",
      ],
    },
    {
      key: "escalation",
      name: "Manual-Review & Escalation",
      glyph: "⤴",
      blurb: "Synthesis, adverse-action reasons & human-in-the-loop",
      start: 0.55,
      end: 0.95,
      doneLabel: "Recommendation ready",
      trailing: true,
      logs: [
        "Weighing subagent signals",
        "Evaluating escalation thresholds",
        "Drafting adverse-action reasons",
        "Composing final recommendation…",
      ],
    },
  ];
}

export default function UnderwritingProgress({ jobId, applicant, rulesName, onDone, onError }: Props) {
  const [phase, setPhase] = useState<Phase>("pending");
  const [elapsed, setElapsed] = useState(0);

  // Keep callbacks/result in refs so the Firestore subscription stays bound to
  // jobId alone (no churn when the parent re-renders with new closures).
  const onDoneRef = useRef(onDone);
  const onErrorRef = useRef(onError);
  onDoneRef.current = onDone;
  onErrorRef.current = onError;
  const resultRef = useRef<UnderwriteResponse | null>(null);

  const lanes = useMemo(() => buildLanes(applicant, rulesName), [applicant, rulesName]);

  // ── Live job status from Firestore (the backend's own writes) ──────────────
  useEffect(() => {
    let settled = false;
    const hardTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      onErrorRef.current(
        "Timed out waiting for the underwriting result. The crew may still finish in the background — check the board shortly."
      );
    }, HARD_TIMEOUT_MS);

    const unsub = listenJob(
      jobId,
      (job) => {
        if (settled) return;
        if (job.status === "done" && job.result) {
          settled = true;
          resultRef.current = job.result as UnderwriteResponse;
          setPhase("done");
        } else if (job.status === "error") {
          settled = true;
          onErrorRef.current(job.detail || "The underwriting run failed.");
        } else if (job.status === "running") {
          setPhase("running");
        } else if (job.status === "pending") {
          setPhase((p) => (p === "running" ? p : "pending"));
        }
        // "missing": brief race before the freshly-created doc is visible — ignore.
      },
      (e) => {
        if (settled) return;
        settled = true;
        onErrorRef.current(e.message);
      }
    );

    return () => {
      clearTimeout(hardTimeout);
      unsub();
    };
  }, [jobId]);

  // Let the user savor the completed crew for a beat before swapping in results.
  useEffect(() => {
    if (phase !== "done") return;
    const t = setTimeout(() => {
      if (resultRef.current) onDoneRef.current(resultRef.current);
    }, 750);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Elapsed clock ──────────────────────────────────────────────────────────
  // Wall-clock based via setInterval (not rAF): rAF fully pauses on a hidden
  // tab, freezing the timeline; setInterval keeps ticking (throttled) so the
  // elapsed time stays honest if the underwriter switches away mid-run. ~8fps
  // while visible — the CSS width transition smooths the bars between ticks.
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setElapsed((performance.now() - start) / 1000), 120);
    return () => clearInterval(id);
  }, []);

  const f = Math.max(0, elapsed) / EXPECTED_S;

  const laneState = (def: LaneDef): { progress: number; state: "queued" | "active" | "complete" } => {
    if (phase === "done") return { progress: 1, state: "complete" };
    let p = (f - def.start) / (def.end - def.start);
    p = Math.min(Math.max(p, 0), 1);
    if (def.trailing) p = Math.min(p, 0.97); // never quite done until Firestore says so
    const state = p <= 0 ? "queued" : p >= 1 ? "complete" : "active";
    return { progress: p, state };
  };

  const laneLog = (def: LaneDef, state: "queued" | "active" | "complete"): string => {
    if (state === "queued") return "Queued · awaiting orchestrator dispatch";
    if (state === "complete") return def.doneLabel;
    const idx = Math.floor(elapsed / 2.3) % def.logs.length;
    return def.logs[idx];
  };

  const doneCount = lanes.filter((d) => laneState(d).state === "complete").length;

  const pct =
    phase === "done" ? 100 : Math.min(96, Math.max(2, Math.round(100 * (1 - Math.exp(-2.4 * f)))));

  // Once the timeline has visibly started, call it "reviewing" even if we're
  // still on the `pending` status write — never leave the title stuck on
  // "Dispatching" while lanes are clearly working.
  const reviewing = phase === "running" || (phase === "pending" && f > 0.03);
  const phaseTitle =
    phase === "done"
      ? "Underwriting recommendation ready"
      : reviewing
        ? "Agent crew is reviewing the file"
        : "Dispatching the case to the orchestrator";

  const mm = Math.floor(elapsed / 60);
  const ss = Math.floor(elapsed % 60);
  const timer = `${mm}:${String(ss).padStart(2, "0")}`;

  const snapshot = [
    creditTier(applicant.creditScore) ? `${applicant.creditScore} · ${creditTier(applicant.creditScore)}` : null,
    applicant.requestedAmount ? `${compactMoney(applicant.requestedAmount)} requested` : null,
    [applicant.vehicle?.year, applicant.vehicle?.make, applicant.vehicle?.model].filter(Boolean).join(" ") || null,
  ].filter(Boolean) as string[];

  return (
    <section className="uw" data-phase={phase} aria-live="polite" aria-busy={phase !== "done"}>
      <div className="uw-scan" aria-hidden />

      <header className="uw-head">
        <div className="uw-core" data-phase={phase}>
          <span className="uw-core-ring" aria-hidden />
          <span className="uw-core-ring two" aria-hidden />
          <span className="uw-core-pct">{pct}%</span>
        </div>
        <div className="uw-head-text">
          <div className="uw-kicker">
            <span className="uw-kicker-dot" />
            Lyzr Underwriting Orchestrator
          </div>
          <strong className="uw-title">{phaseTitle}</strong>
          <div className="uw-snapshot">
            {applicant.fullName ? <b>{applicant.fullName}</b> : "This case"}
            {snapshot.length > 0 && (
              <>
                {"  ·  "}
                {snapshot.join("  ·  ")}
              </>
            )}
          </div>
        </div>
        <div className="uw-head-meta">
          <span className="uw-agents">
            {doneCount}/{lanes.length} subagents
          </span>
          <span className="uw-timer">{timer}</span>
        </div>
      </header>

      <div className="uw-lanes">
        {lanes.map((def, i) => {
          const st = laneState(def);
          return (
            <div
              key={def.key}
              className="uw-lane"
              data-state={st.state}
              style={{ ["--i" as string]: i, ["--p" as string]: st.progress }}
            >
              <div className="uw-lane-glyph" aria-hidden>
                <span className="uw-lane-glyph-mark">{def.glyph}</span>
              </div>
              <div className="uw-lane-main">
                <div className="uw-lane-top">
                  <span className="uw-lane-name">{def.name}</span>
                  <span className="uw-lane-status">
                    {st.state === "queued" ? "Queued" : st.state === "complete" ? "Complete" : "Analyzing"}
                  </span>
                </div>
                <div className="uw-lane-blurb">{def.blurb}</div>
                <div className="uw-bar">
                  <div className="uw-bar-fill" style={{ width: `${Math.round(st.progress * 100)}%` }} />
                </div>
                <div className="uw-log">
                  <span className="uw-log-cursor" aria-hidden />
                  {laneLog(def, st.state)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <footer className="uw-foot">
        <span className="uw-foot-bars" aria-hidden>
          <i /><i /><i /><i /><i />
        </span>
        <span className="uw-foot-note">
          {phase === "done"
            ? "Crew aligned — compiling the recommendation."
            : "Typically ~4 minutes. This runs in the background — you can close this window and the board will update when the decision lands."}
        </span>
      </footer>
    </section>
  );
}
