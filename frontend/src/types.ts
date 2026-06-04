// ─────────────────────────────────────────────────────────────────────────
// Firestore schema (client-side types)
//
// Collections
//   users/{uid}                 — one per Firebase Auth user (applicant or
//                                 underwriter). Created right after register.
//   underwriting_rules/{id}     — reusable policy presets shown in the Create
//                                 modal's dropdown.
//   applicants/{id}             — the kanban tickets. One card per applicant.
//   underwriting_jobs/{id}      — agent runs (written by the backend admin
//                                 SDK; the browser never writes these). Each
//                                 job links back to its applicant via
//                                 `applicantId` so process_job can move the
//                                 card when the decision lands.
// ─────────────────────────────────────────────────────────────────────────

export type Role = "applicant" | "underwriter";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  /** Free-text company for underwriters; optional for applicants. */
  organization?: string;
  createdAt?: number; // epoch ms (client mirror of the server timestamp)
}

// ─── Kanban pipeline ───────────────────────────────────────────────────────
// The `stage` field is the column an applicant card sits in. Order here is the
// left-to-right order on the board.
export type Stage =
  | "new"
  | "underwriting"
  | "manual_review"
  | "conditional"
  | "approved"
  | "declined";

export interface StageMeta {
  key: Stage;
  label: string;
  /** CSS accent color (hex) for the column header / card rail. */
  accent: string;
  blurb: string;
}

// Stage accents flow as a futuristic arctic ramp: dark cyan → bright arctic
// cyan → cyan-green → green → bright green across the "good" pipeline, with
// Declined held at the alert red.
export const STAGES: StageMeta[] = [
  { key: "new", label: "Intake", accent: "#0E7E97", blurb: "Newly submitted" },
  { key: "underwriting", label: "Underwriting", accent: "#1FB0D0", blurb: "Agent crew reviewing" },
  { key: "manual_review", label: "Manual Review", accent: "#2BDDC4", blurb: "Needs a human" },
  { key: "conditional", label: "Conditional", accent: "#38EFA2", blurb: "Approved with conditions" },
  { key: "approved", label: "Approved", accent: "#5CFF85", blurb: "Cleared to fund" },
  { key: "declined", label: "Declined", accent: "#ff5b6b", blurb: "Adverse action" },
];

export const STAGE_BY_KEY: Record<Stage, StageMeta> = STAGES.reduce(
  (acc, s) => ((acc[s.key] = s), acc),
  {} as Record<Stage, StageMeta>
);

export type Priority = "low" | "medium" | "high";
export type Decision = "YES" | "NO";

/** Snapshot of structured numbers shown on the card without opening it. */
export interface VehicleInfo {
  year?: number;
  make?: string;
  model?: string;
  mileage?: number;
  value?: number;
}

export interface Applicant {
  id: string;

  // Identity
  fullName: string;
  email?: string;
  phone?: string;

  // Kanban
  stage: Stage;
  priority: Priority;
  /** uid of the underwriter who owns the case (optional). */
  assignedTo?: string;

  // Structured loan snapshot (for the card face)
  creditScore?: number;
  monthlyIncome?: number;
  monthlyDebt?: number;
  requestedAmount?: number;
  downPayment?: number;
  vehicle?: VehicleInfo;
  loanTermMonths?: number;
  estimatedApr?: number;
  estimatedMonthlyPayment?: number;

  /** Free-text blob fed verbatim to the underwriting agent. */
  applicantData: string;

  // Linkage
  /** uid of the applicant user this card belongs to (for the applicant view). */
  linkedUserId?: string;
  /** uid of whoever created the card. */
  createdBy?: string;
  /** Rule preset selected when underwriting was last run. */
  rulesId?: string;
  /** Most recent underwriting_jobs doc id. */
  latestJobId?: string;

  // Decision (mirrored from the latest finished job)
  decision?: Decision | null;
  /** Raw orchestrator status line, e.g. "Conditional Approval". */
  decisionStatus?: string;
  /** One-line summary from the agent, for the card. */
  decisionSummary?: string;

  tags?: string[];
  createdAt?: number;
  updatedAt?: number;
}

/** Input shape when creating a card (id/timestamps assigned on write). */
export type ApplicantDraft = Omit<Applicant, "id" | "createdAt" | "updatedAt">;

export interface UnderwritingRule {
  id: string;
  name: string;
  description: string;
  /** The full policy text dropped into the Rules & Guidelines textarea. */
  body: string;
  /** prime | near-prime | subprime | ev | … (for grouping/badges). */
  category?: string;
  isDefault?: boolean;
  createdBy?: string;
  createdAt?: number;
}

export type UnderwritingRuleDraft = Omit<UnderwritingRule, "id" | "createdAt">;
