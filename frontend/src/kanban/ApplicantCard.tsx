import { avatarColor, compactMoney, dtiPct, initials, ltvPct, timeAgo } from "../format";
import { STAGE_BY_KEY, type Applicant } from "../types";

interface Props {
  applicant: Applicant;
  draggable: boolean;
  onOpen: (a: Applicant) => void;
  onDragStart: (a: Applicant) => void;
  onDragEnd: () => void;
  dragging: boolean;
}

export default function ApplicantCard({
  applicant: a,
  draggable,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: Props) {
  const accent = STAGE_BY_KEY[a.stage]?.accent ?? "#7DEBFF";
  const color = avatarColor(a.fullName);
  const dti = dtiPct(a);
  const ltv = ltvPct(a);
  const vehicle = [a.vehicle?.year, a.vehicle?.make, a.vehicle?.model]
    .filter(Boolean)
    .join(" ");
  const isRunning = a.stage === "underwriting" && !a.decision;

  return (
    <article
      className={`kcard ${dragging ? "is-dragging" : ""}`}
      style={{ ["--rail" as string]: accent }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", a.id);
        onDragStart(a);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(a)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(a);
        }
      }}
    >
      <span className="kcard-rail" />
      <header className="kcard-head">
        <span className="kcard-avatar" style={{ ["--av" as string]: color }}>
          {initials(a.fullName)}
        </span>
        <div className="kcard-id">
          <div className="kcard-name">{a.fullName}</div>
          <div className="kcard-meta">
            {a.creditScore ? `FICO ${a.creditScore}` : "Credit n/a"}
            {vehicle ? ` · ${vehicle}` : ""}
          </div>
        </div>
      </header>

      <div className="kcard-metrics">
        <Metric label="Requested" value={compactMoney(a.requestedAmount)} />
        <Metric label="Payment" value={a.estimatedMonthlyPayment ? `${compactMoney(a.estimatedMonthlyPayment)}/mo` : "—"} />
        <Metric label="DTI" value={dti !== undefined ? `${dti}%` : "—"} />
        <Metric label="LTV" value={ltv !== undefined ? `${ltv}%` : "—"} />
      </div>

      {isRunning ? (
        <div className="kcard-running">
          <span className="loading-pulse sm" />
          Agent crew reviewing…
        </div>
      ) : (
        a.decisionSummary && <p className="kcard-summary">{a.decisionSummary}</p>
      )}

      <footer className="kcard-foot">
        <div className="kcard-tags">
          {a.decision && (
            <span className={`tag tag-decision ${a.decision === "YES" ? "yes" : "no"}`}>
              {a.decisionStatus || (a.decision === "YES" ? "Approved" : "Declined")}
            </span>
          )}
          {(a.tags ?? []).slice(0, 2).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <span className="kcard-time">{timeAgo(a.updatedAt ?? a.createdAt)}</span>
      </footer>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="kmetric">
      <span className="kmetric-label">{label}</span>
      <span className="kmetric-value">{value}</span>
    </div>
  );
}
