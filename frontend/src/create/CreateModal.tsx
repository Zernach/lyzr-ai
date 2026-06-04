import { useMemo, useState } from "react";
import { beginUnderwriting, type UnderwriteResponse } from "../api";
import { createApplicant, updateApplicant } from "../db";
import { SAMPLE_APPLICANT, SAMPLE_RULES } from "../samples";
import type { ApplicantDraft, Priority, Role, UnderwritingRule } from "../types";
import UnderwriteResult from "../UnderwriteResult";
import UnderwritingProgress, { type ProgressApplicant } from "../UnderwritingProgress";

interface Props {
  role: Role;
  uid: string;
  rules: UnderwritingRule[];
  onClose: () => void;
  onCreated?: (id: string) => void;
}

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  priority: Priority;
  creditScore: string;
  monthlyIncome: string;
  monthlyDebt: string;
  requestedAmount: string;
  downPayment: string;
  vYear: string;
  vMake: string;
  vModel: string;
  vMileage: string;
  vValue: string;
  loanTermMonths: string;
  estimatedApr: string;
}

const EMPTY: FormState = {
  fullName: "",
  email: "",
  phone: "",
  priority: "medium",
  creditScore: "",
  monthlyIncome: "",
  monthlyDebt: "",
  requestedAmount: "",
  downPayment: "",
  vYear: "",
  vMake: "",
  vModel: "",
  vMileage: "",
  vValue: "",
  loanTermMonths: "",
  estimatedApr: "",
};

const num = (s: string): number | undefined => {
  const n = Number(s.replace(/[^0-9.]/g, ""));
  return s.trim() === "" || Number.isNaN(n) ? undefined : n;
};

function calcPayment(principal?: number, aprPct?: number, months?: number): number | undefined {
  if (!principal || !months) return undefined;
  const r = (aprPct ?? 0) / 100 / 12;
  const p = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  return Math.round(p);
}

export default function CreateModal({ role, uid, rules, onClose, onCreated }: Props) {
  const isUnderwriter = role === "underwriter";

  const [form, setForm] = useState<FormState>(EMPTY);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(
    () => rules.find((r) => r.isDefault)?.id ?? rules[0]?.id ?? ""
  );
  const [rulesText, setRulesText] = useState<string>(
    () => rules.find((r) => r.isDefault)?.body ?? rules[0]?.body ?? ""
  );
  const [applicantData, setApplicantData] = useState("");

  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UnderwriteResponse | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // "busy" = a run is in flight, from the moment we hit Create until the crew
  // returns a decision (or errors). jobId being set means the Firestore-watched
  // progress view is on screen.
  const busy = running || jobId !== null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const estPayment = useMemo(
    () => calcPayment(num(form.requestedAmount), num(form.estimatedApr), num(form.loanTermMonths)),
    [form.requestedAmount, form.estimatedApr, form.loanTermMonths]
  );

  const progressApplicant = useMemo<ProgressApplicant>(
    () => ({
      fullName: form.fullName.trim() || undefined,
      creditScore: num(form.creditScore),
      monthlyIncome: num(form.monthlyIncome),
      monthlyDebt: num(form.monthlyDebt),
      requestedAmount: num(form.requestedAmount),
      downPayment: num(form.downPayment),
      vehicle: {
        year: num(form.vYear),
        make: form.vMake.trim() || undefined,
        model: form.vModel.trim() || undefined,
        mileage: num(form.vMileage),
        value: num(form.vValue),
      },
      loanTermMonths: num(form.loanTermMonths),
      estimatedApr: num(form.estimatedApr),
      estimatedMonthlyPayment: estPayment,
    }),
    [form, estPayment]
  );

  const onPickRule = (id: string) => {
    setSelectedRuleId(id);
    const r = rules.find((x) => x.id === id);
    if (r) setRulesText(r.body);
  };

  /** Compose the agent-facing applicant blob from the structured fields. */
  const composeData = (): string => {
    const lines: string[] = [];
    const push = (label: string, v?: string | number) => {
      if (v !== undefined && v !== "") lines.push(`${label}: ${v}`);
    };
    push("Applicant", form.fullName);
    push("Credit score", form.creditScore);
    push("Monthly gross income", form.monthlyIncome && `$${num(form.monthlyIncome)?.toLocaleString()}`);
    push("Existing monthly debt obligations", form.monthlyDebt && `$${num(form.monthlyDebt)?.toLocaleString()}`);
    push("Requested loan amount", form.requestedAmount && `$${num(form.requestedAmount)?.toLocaleString()}`);
    push("Down payment", form.downPayment && `$${num(form.downPayment)?.toLocaleString()}`);
    const veh = [form.vYear, form.vMake, form.vModel].filter(Boolean).join(" ");
    if (veh) push("Vehicle", `${veh}${form.vMileage ? `, ${num(form.vMileage)?.toLocaleString()} miles` : ""}`);
    push("Vehicle value", form.vValue && `$${num(form.vValue)?.toLocaleString()}`);
    push("Loan term", form.loanTermMonths && `${form.loanTermMonths} months`);
    push("Estimated APR", form.estimatedApr && `${form.estimatedApr}%`);
    if (estPayment) push("Estimated monthly payment", `$${estPayment.toLocaleString()}`);
    return lines.join("\n");
  };

  const effectiveData = (): string => applicantData.trim() || composeData();

  const buildDraft = (stage: ApplicantDraft["stage"]): ApplicantDraft => ({
    fullName: form.fullName.trim() || "Unnamed applicant",
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    stage,
    priority: form.priority,
    creditScore: num(form.creditScore),
    monthlyIncome: num(form.monthlyIncome),
    monthlyDebt: num(form.monthlyDebt),
    requestedAmount: num(form.requestedAmount),
    downPayment: num(form.downPayment),
    vehicle: {
      year: num(form.vYear),
      make: form.vMake.trim() || undefined,
      model: form.vModel.trim() || undefined,
      mileage: num(form.vMileage),
      value: num(form.vValue),
    },
    loanTermMonths: num(form.loanTermMonths),
    estimatedApr: num(form.estimatedApr),
    estimatedMonthlyPayment: estPayment,
    applicantData: effectiveData(),
    rulesId: isUnderwriter ? selectedRuleId || undefined : undefined,
    createdBy: uid,
    linkedUserId: isUnderwriter ? undefined : uid,
    decision: null,
  });

  const loadSample = () => {
    setForm({
      ...EMPTY,
      fullName: "Darnell Fisher (sample)",
      priority: "high",
      creditScore: "642",
      monthlyIncome: "5200",
      monthlyDebt: "2050",
      requestedAmount: "28000",
      downPayment: "2000",
      vYear: "2021",
      vMake: "Jeep",
      vModel: "Grand Cherokee",
      vMileage: "48000",
      vValue: "29500",
      loanTermMonths: "72",
      estimatedApr: "11.5",
    });
    setApplicantData(SAMPLE_APPLICANT);
    if (isUnderwriter) setRulesText(SAMPLE_RULES);
  };

  const validName = form.fullName.trim().length > 0;

  // Applicant role: just file the application onto the board (no run).
  const onSubmitApplication = async () => {
    setError(null);
    if (!validName) return setError("Please enter your full name.");
    if (!effectiveData()) return setError("Please add some application details.");
    try {
      setRunning(true);
      const id = await createApplicant(buildDraft("new"));
      onCreated?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  };

  // Underwriter: drop a card in Intake without running the agent.
  const onAddToBoard = async () => {
    setError(null);
    if (!validName) return setError("Please enter the applicant's name.");
    try {
      setRunning(true);
      const id = await createApplicant(buildDraft("new"));
      onCreated?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRunning(false);
    }
  };

  // Underwriter: create the card AND launch the agent crew. We only START the
  // job here (a quick POST); the live progress view then watches the Firestore
  // job doc to completion. The backend's process_job mirrors the decision +
  // stage onto the card via the Admin SDK, so we deliberately don't write those
  // back from here — the board's live listener reflects them.
  const onCreateAndRun = async () => {
    setError(null);
    setResult(null);
    const data = effectiveData();
    if (!validName) return setError("Please enter the applicant's name.");
    if (!rulesText.trim()) return setError("Underwriting rules are required to run a review.");
    if (!data) return setError("Applicant data is required to run a review.");

    setRunning(true);
    let id = createdId;
    try {
      if (!id) {
        id = await createApplicant(buildDraft("underwriting"));
        setCreatedId(id);
        onCreated?.(id);
      } else {
        await updateApplicant(id, { stage: "underwriting" });
      }
      const jid = await beginUnderwriting(rulesText, data, {
        applicantId: id,
        rulesId: selectedRuleId || undefined,
        createdBy: uid,
      });
      if (id) void updateApplicant(id, { latestJobId: jid });
      setJobId(jid);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // Couldn't even start — park the card so it isn't stuck spinning.
      if (id) void updateApplicant(id, { stage: "manual_review" });
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

  return (
    <div className="modal-overlay">
      <div className="modal create-modal">
        <header className="modal-head">
          <div className="panel-title">
            <span className="panel-title-bar" />
            {isUnderwriter ? "New underwriting case" : "Submit an application"}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal-body">
          <div className={`create-grid ${isUnderwriter ? "" : "single"}`}>
            {/* Applicant column */}
            <div className="panel">
              <div className="panel-head">
                <div className="panel-title">
                  <span className="panel-title-bar" />
                  Applicant Data
                </div>
                <button className="btn btn-ghost btn-sm" onClick={loadSample} type="button">
                  Load sample
                </button>
              </div>

              <div className="form-grid">
                <Field label="Full name" full>
                  <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Jane Applicant" />
                </Field>
                <Field label="Email">
                  <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@example.com" />
                </Field>
                <Field label="Phone">
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 555-0100" />
                </Field>
                <Field label="Credit score">
                  <input value={form.creditScore} onChange={(e) => set("creditScore", e.target.value)} inputMode="numeric" placeholder="700" />
                </Field>
                <Field label="Priority">
                  <select value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
                <Field label="Monthly income">
                  <input value={form.monthlyIncome} onChange={(e) => set("monthlyIncome", e.target.value)} inputMode="numeric" placeholder="6000" />
                </Field>
                <Field label="Monthly debt">
                  <input value={form.monthlyDebt} onChange={(e) => set("monthlyDebt", e.target.value)} inputMode="numeric" placeholder="1500" />
                </Field>
                <Field label="Requested amount">
                  <input value={form.requestedAmount} onChange={(e) => set("requestedAmount", e.target.value)} inputMode="numeric" placeholder="28000" />
                </Field>
                <Field label="Down payment">
                  <input value={form.downPayment} onChange={(e) => set("downPayment", e.target.value)} inputMode="numeric" placeholder="2000" />
                </Field>
                <Field label="Vehicle year">
                  <input value={form.vYear} onChange={(e) => set("vYear", e.target.value)} inputMode="numeric" placeholder="2022" />
                </Field>
                <Field label="Make">
                  <input value={form.vMake} onChange={(e) => set("vMake", e.target.value)} placeholder="Honda" />
                </Field>
                <Field label="Model">
                  <input value={form.vModel} onChange={(e) => set("vModel", e.target.value)} placeholder="CR-V" />
                </Field>
                <Field label="Mileage">
                  <input value={form.vMileage} onChange={(e) => set("vMileage", e.target.value)} inputMode="numeric" placeholder="31000" />
                </Field>
                <Field label="Vehicle value">
                  <input value={form.vValue} onChange={(e) => set("vValue", e.target.value)} inputMode="numeric" placeholder="28200" />
                </Field>
                <Field label="Term (months)">
                  <input value={form.loanTermMonths} onChange={(e) => set("loanTermMonths", e.target.value)} inputMode="numeric" placeholder="60" />
                </Field>
                <Field label="Estimated APR %">
                  <input value={form.estimatedApr} onChange={(e) => set("estimatedApr", e.target.value)} inputMode="decimal" placeholder="7.4" />
                </Field>
              </div>

              {estPayment !== undefined && (
                <div className="calc-hint">Estimated monthly payment ≈ ${estPayment.toLocaleString()}</div>
              )}

              <div className="field-label" style={{ marginTop: 14 }}>
                <span>Full applicant narrative (sent to the agent — leave blank to auto-build from the fields above)</span>
              </div>
              <textarea
                className="input create-textarea"
                value={applicantData}
                onChange={(e) => setApplicantData(e.target.value)}
                placeholder={composeData() || "Credit, income, vehicle, loan structure, history…"}
                spellCheck={false}
              />
            </div>

            {/* Rules column (underwriter only) */}
            {isUnderwriter && (
              <div className="panel">
                <div className="panel-head">
                  <div className="panel-title">
                    <span className="panel-title-bar" />
                    Underwriting Rules &amp; Guidelines
                  </div>
                  <div className="panel-sub">{rulesText.length.toLocaleString()} chars</div>
                </div>

                <div className="field-label">
                  <span>Choose a preset</span>
                </div>
                <select
                  className="rule-select"
                  value={selectedRuleId}
                  onChange={(e) => onPickRule(e.target.value)}
                >
                  {rules.length === 0 && <option value="">No presets yet</option>}
                  {rules.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.isDefault ? "  ·  default" : ""}
                    </option>
                  ))}
                </select>

                <textarea
                  className="input create-textarea tall"
                  value={rulesText}
                  onChange={(e) => setRulesText(e.target.value)}
                  placeholder="Paste your policy, thresholds, and program limits…"
                  spellCheck={false}
                />
              </div>
            )}
          </div>

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
            <UnderwritingProgress
              jobId={jobId}
              applicant={progressApplicant}
              rulesName={rules.find((r) => r.id === selectedRuleId)?.name}
              onDone={onProgressDone}
              onError={onProgressError}
            />
          )}

          {error && (
            <div className="error">
              <strong>Couldn&rsquo;t complete</strong>
              {error}
            </div>
          )}

          {result && <UnderwriteResult result={result} />}
        </div>

        <footer className="modal-foot">
          <div className="modal-foot-note">
            {result
              ? "Saved to the board. You can close this window."
              : isUnderwriter
              ? "Create a card, optionally running the agent crew now."
              : "Your application will appear in the underwriter's intake queue."}
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose} type="button">
              {result ? "Close" : "Cancel"}
            </button>
            {isUnderwriter ? (
              <>
                <button className="btn" onClick={onAddToBoard} disabled={busy} type="button">
                  Add to board
                </button>
                <button className="btn btn-primary" onClick={onCreateAndRun} disabled={busy} type="button">
                  {busy ? "Running…" : result ? "Re-run" : "Create & Run Underwriting"}
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={onSubmitApplication} disabled={busy} type="button">
                {busy ? "Submitting…" : "Submit application"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({
  label,
  full,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`mini-field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
