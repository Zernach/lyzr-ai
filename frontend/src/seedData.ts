// Demo dataset seeded into Firestore the first time an underwriter opens an
// empty board (see App auto-seed). Two collections:
//   • underwriting_rules  — policy presets for the Create modal's dropdown
//   • applicants          — the kanban cards
import type { ApplicantDraft, UnderwritingRuleDraft } from "./types";

// ─── Underwriting rule presets ────────────────────────────────────────────────

export const SEED_RULES: UnderwritingRuleDraft[] = [
  {
    name: "Standard Prime Auto Policy",
    category: "prime",
    isDefault: true,
    description: "Baseline policy for prime/near-prime applicants.",
    body: `Working underwriting policy — Standard Prime Auto:

Credit score 740+: strong credit profile
Credit score 670–739: standard review
Credit score 580–669: elevated-risk review; may qualify with compensating factors
Credit score below 580: high-risk review and likely decline unless strong exception applies
Maximum front-end payment-to-income ratio: 15%
Maximum total debt-to-income ratio after proposed auto loan: 50%
Maximum loan-to-value ratio for used vehicles: 110%
Maximum term for used vehicles under 6 years old and under 75,000 miles: 72 months
Recent 60-day delinquency within 12 months requires manual review unless strong compensating factors exist`,
  },
  {
    name: "Near-Prime Standard Review",
    category: "near-prime",
    description: "Slightly looser score floor with tighter affordability checks.",
    body: `Near-Prime Standard Review policy:

Credit score 660+: standard review
Credit score 600–659: elevated-risk review; require two compensating factors
Credit score below 600: decline unless an exception is documented and approved
Maximum front-end payment-to-income ratio: 18%
Maximum total debt-to-income ratio after proposed auto loan: 48%
Maximum loan-to-value ratio for used vehicles: 120%
Maximum term: 75 months
Verified income required via two pay stubs or three months of bank statements
Any repossession or charge-off in the last 24 months requires manual review`,
  },
  {
    name: "Subprime Program",
    category: "subprime",
    description: "Higher-risk borrowers; conservative LTV/term, strong stips.",
    body: `Subprime Program policy:

Credit score 520–619 eligible with compensating factors
Credit score below 520: decline
Maximum front-end payment-to-income ratio: 12%
Maximum total debt-to-income ratio after proposed auto loan: 45%
Maximum loan-to-value ratio: 105%
Maximum term: 60 months
Minimum down payment: 10% of vehicle value
Proof of residence and 6+ months at current employer required
No open bankruptcy; discharged bankruptcy must be 12+ months old`,
  },
  {
    name: "EV & Hybrid Program",
    category: "ev",
    description: "Electric/hybrid collateral with battery-aware valuation.",
    body: `EV & Hybrid Program policy:

Credit score 680+: standard review
Credit score 620–679: elevated-risk review
Maximum loan-to-value ratio for new EVs: 125% (includes eligible incentives)
Maximum loan-to-value ratio for used EVs: 115%; require battery state-of-health report for vehicles 4+ years old
Maximum term: 84 months for new EVs, 72 months for used EVs
Maximum total debt-to-income ratio after proposed auto loan: 50%
Charging infrastructure / home eligibility is informational only, not a decision factor`,
  },
  {
    name: "Used Vehicle — Conservative",
    category: "used",
    description: "Strict mileage, term, and LTV caps for older collateral.",
    body: `Used Vehicle — Conservative policy:

Credit score 700+: standard review
Credit score 640–699: elevated-risk review
Vehicles over 100,000 miles or older than 8 model years require manual review
Maximum loan-to-value ratio: 100% of clean-retail book value
Maximum term: 60 months
Maximum front-end payment-to-income ratio: 14%
Maximum total debt-to-income ratio after proposed auto loan: 45%
GAP coverage recommended when LTV exceeds 95%`,
  },
];

// ─── Applicant card builder ───────────────────────────────────────────────────

interface Spec {
  fullName: string;
  email: string;
  phone: string;
  stage: ApplicantDraft["stage"];
  priority: ApplicantDraft["priority"];
  creditScore: number;
  monthlyIncome: number;
  monthlyDebt: number;
  requestedAmount: number;
  downPayment: number;
  vehicle: { year: number; make: string; model: string; mileage: number; value: number };
  loanTermMonths: number;
  estimatedApr: number;
  estimatedMonthlyPayment: number;
  employment: string;
  history: string;
  tags?: string[];
  decision?: "YES" | "NO" | null;
  decisionStatus?: string;
  decisionSummary?: string;
}

function money(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

function buildData(s: Spec): string {
  return [
    `Applicant: ${s.fullName}`,
    `Credit score: ${s.creditScore}`,
    `Monthly gross income: ${money(s.monthlyIncome)}`,
    `Monthly verified income: ${money(s.monthlyIncome)}`,
    `Existing monthly debt obligations: ${money(s.monthlyDebt)}`,
    `Requested loan amount: ${money(s.requestedAmount)}`,
    `Down payment: ${money(s.downPayment)}`,
    `Vehicle: ${s.vehicle.year} ${s.vehicle.make} ${s.vehicle.model}, ${s.vehicle.mileage.toLocaleString()} miles`,
    `Vehicle value: ${money(s.vehicle.value)}`,
    `Loan term: ${s.loanTermMonths} months`,
    `Estimated APR: ${s.estimatedApr}%`,
    `Estimated monthly payment: ${money(s.estimatedMonthlyPayment)}`,
    `Employment status: ${s.employment}`,
    `Credit history: ${s.history}`,
  ].join("\n");
}

const SPECS: Spec[] = [
  // ── Intake (new) ──
  {
    fullName: "Maya Okafor",
    email: "maya.okafor@example.com",
    phone: "(602) 555-0148",
    stage: "new",
    priority: "medium",
    creditScore: 724,
    monthlyIncome: 6400,
    monthlyDebt: 1450,
    requestedAmount: 26500,
    downPayment: 3500,
    vehicle: { year: 2022, make: "Honda", model: "CR-V", mileage: 31000, value: 28200 },
    loanTermMonths: 60,
    estimatedApr: 7.4,
    estimatedMonthlyPayment: 530,
    employment: "Full-time, employed 4 years",
    history: "No delinquencies, no bankruptcy, 1 prior auto loan paid in full",
    tags: ["Repeat customer"],
  },
  {
    fullName: "Tobias Reuter",
    email: "t.reuter@example.com",
    phone: "(415) 555-0193",
    stage: "new",
    priority: "low",
    creditScore: 805,
    monthlyIncome: 9100,
    monthlyDebt: 1200,
    requestedAmount: 41000,
    downPayment: 9000,
    vehicle: { year: 2024, make: "Toyota", model: "Tacoma", mileage: 8, value: 47500 },
    loanTermMonths: 72,
    estimatedApr: 5.9,
    estimatedMonthlyPayment: 678,
    employment: "Full-time, employed 11 years",
    history: "Excellent history, no derogatory marks",
    tags: ["Prime", "New vehicle"],
  },
  // ── Underwriting (running) ──
  {
    fullName: "Priya Nandakumar",
    email: "priya.n@example.com",
    phone: "(206) 555-0117",
    stage: "underwriting",
    priority: "medium",
    creditScore: 698,
    monthlyIncome: 5800,
    monthlyDebt: 1900,
    requestedAmount: 32000,
    downPayment: 2000,
    vehicle: { year: 2023, make: "Tesla", model: "Model 3", mileage: 14500, value: 33500 },
    loanTermMonths: 72,
    estimatedApr: 8.2,
    estimatedMonthlyPayment: 560,
    employment: "Full-time, employed 3 years",
    history: "One 30-day delinquency 18 months ago, otherwise clean",
    tags: ["EV"],
  },
  {
    fullName: "Darnell Fisher",
    email: "d.fisher@example.com",
    phone: "(312) 555-0162",
    stage: "underwriting",
    priority: "high",
    creditScore: 641,
    monthlyIncome: 5200,
    monthlyDebt: 2050,
    requestedAmount: 28000,
    downPayment: 2000,
    vehicle: { year: 2021, make: "Jeep", model: "Grand Cherokee", mileage: 48000, value: 29500 },
    loanTermMonths: 72,
    estimatedApr: 11.5,
    estimatedMonthlyPayment: 540,
    employment: "Full-time, employed 2.5 years",
    history: "One 60-day delinquency 10 months ago, no bankruptcy or repossession",
    tags: ["Elevated risk"],
  },
  // ── Manual review ──
  {
    fullName: "Helena Vásquez",
    email: "helena.v@example.com",
    phone: "(305) 555-0175",
    stage: "manual_review",
    priority: "high",
    creditScore: 612,
    monthlyIncome: 4300,
    monthlyDebt: 1750,
    requestedAmount: 24000,
    downPayment: 1000,
    vehicle: { year: 2019, make: "Nissan", model: "Altima", mileage: 86000, value: 16500 },
    loanTermMonths: 72,
    estimatedApr: 14.9,
    estimatedMonthlyPayment: 498,
    employment: "Full-time, employed 1 year",
    history: "Repossession 26 months ago, recovering credit, no recent late payments",
    tags: ["LTV exception"],
    decision: null,
    decisionStatus: "Manual Review Required",
    decisionSummary:
      "LTV ~145% and a repossession within 36 months trip two manual-review flags; needs human sign-off.",
  },
  {
    fullName: "Grant Whitfield",
    email: "grant.w@example.com",
    phone: "(720) 555-0139",
    stage: "manual_review",
    priority: "medium",
    creditScore: 705,
    monthlyIncome: 7200,
    monthlyDebt: 3100,
    requestedAmount: 38000,
    downPayment: 4000,
    vehicle: { year: 2022, make: "Ford", model: "F-150", mileage: 22000, value: 41000 },
    loanTermMonths: 84,
    estimatedApr: 8.9,
    estimatedMonthlyPayment: 612,
    employment: "Self-employed, 2 years; income via tax returns",
    history: "Clean, but self-employed income needs verification",
    tags: ["Income verification"],
    decision: null,
    decisionStatus: "Manual Review Required",
    decisionSummary:
      "Self-employed income and an 84-month term beyond policy require an underwriter to verify and document an exception.",
  },
  // ── Conditional ──
  {
    fullName: "Aiko Tanaka",
    email: "aiko.tanaka@example.com",
    phone: "(408) 555-0184",
    stage: "conditional",
    priority: "medium",
    creditScore: 686,
    monthlyIncome: 6100,
    monthlyDebt: 1500,
    requestedAmount: 30000,
    downPayment: 3000,
    vehicle: { year: 2023, make: "Hyundai", model: "Ioniq 5", mileage: 9000, value: 34000 },
    loanTermMonths: 72,
    estimatedApr: 7.8,
    estimatedMonthlyPayment: 521,
    employment: "Full-time, employed 5 years",
    history: "No derogatory marks; thin file with limited installment history",
    tags: ["EV", "Conditional"],
    decision: "YES",
    decisionStatus: "Conditional Approval",
    decisionSummary:
      "Approvable subject to proof of income and a battery state-of-health report for the used EV.",
  },
  {
    fullName: "Carlos Medina",
    email: "carlos.medina@example.com",
    phone: "(915) 555-0150",
    stage: "conditional",
    priority: "low",
    creditScore: 715,
    monthlyIncome: 5600,
    monthlyDebt: 1300,
    requestedAmount: 22500,
    downPayment: 1500,
    vehicle: { year: 2020, make: "Subaru", model: "Outback", mileage: 54000, value: 23800 },
    loanTermMonths: 66,
    estimatedApr: 7.1,
    estimatedMonthlyPayment: 405,
    employment: "Full-time, employed 6 years",
    history: "Strong history; one recent inquiry",
    tags: ["Conditional"],
    decision: "YES",
    decisionStatus: "Conditional Approval",
    decisionSummary:
      "Approve with a larger down payment to bring LTV under 100% per the conservative used-vehicle policy.",
  },
  // ── Approved ──
  {
    fullName: "Eleanor Shaw",
    email: "eleanor.shaw@example.com",
    phone: "(617) 555-0121",
    stage: "approved",
    priority: "low",
    creditScore: 781,
    monthlyIncome: 8200,
    monthlyDebt: 1100,
    requestedAmount: 34000,
    downPayment: 6000,
    vehicle: { year: 2023, make: "Lexus", model: "RX 350", mileage: 12000, value: 42000 },
    loanTermMonths: 60,
    estimatedApr: 6.2,
    estimatedMonthlyPayment: 661,
    employment: "Full-time, employed 9 years",
    history: "Excellent; multiple paid-in-full auto loans",
    tags: ["Prime"],
    decision: "YES",
    decisionStatus: "Preliminary Approval",
    decisionSummary:
      "Strong credit, low DTI, and healthy down payment; well within all policy thresholds.",
  },
  {
    fullName: "Samuel Adeyemi",
    email: "samuel.a@example.com",
    phone: "(404) 555-0166",
    stage: "approved",
    priority: "low",
    creditScore: 752,
    monthlyIncome: 7000,
    monthlyDebt: 1400,
    requestedAmount: 27000,
    downPayment: 4500,
    vehicle: { year: 2022, make: "Mazda", model: "CX-5", mileage: 26000, value: 28500 },
    loanTermMonths: 60,
    estimatedApr: 6.6,
    estimatedMonthlyPayment: 528,
    employment: "Full-time, employed 7 years",
    history: "Clean, no late payments in 5 years",
    tags: ["Prime", "Repeat customer"],
    decision: "YES",
    decisionStatus: "Preliminary Approval",
    decisionSummary:
      "Comfortably qualifies; front-end PTI and DTI are well under policy limits.",
  },
  // ── Declined ──
  {
    fullName: "Brianna Lott",
    email: "brianna.lott@example.com",
    phone: "(704) 555-0188",
    stage: "declined",
    priority: "high",
    creditScore: 548,
    monthlyIncome: 3100,
    monthlyDebt: 1850,
    requestedAmount: 21000,
    downPayment: 500,
    vehicle: { year: 2018, make: "Dodge", model: "Charger", mileage: 98000, value: 15800 },
    loanTermMonths: 72,
    estimatedApr: 18.5,
    estimatedMonthlyPayment: 470,
    employment: "Part-time, employed 8 months",
    history: "Open collection accounts, 90-day delinquency 4 months ago",
    tags: ["High risk"],
    decision: "NO",
    decisionStatus: "Decline",
    decisionSummary:
      "Sub-550 score, DTI over policy, and a recent 90-day delinquency place this outside all programs.",
  },
  {
    fullName: "Victor Petrov",
    email: "v.petrov@example.com",
    phone: "(503) 555-0144",
    stage: "declined",
    priority: "medium",
    creditScore: 596,
    monthlyIncome: 4000,
    monthlyDebt: 2400,
    requestedAmount: 33000,
    downPayment: 0,
    vehicle: { year: 2021, make: "BMW", model: "3 Series", mileage: 41000, value: 29000 },
    loanTermMonths: 84,
    estimatedApr: 16.2,
    estimatedMonthlyPayment: 612,
    employment: "Full-time, employed 1.5 years",
    history: "Charge-off 14 months ago; high revolving utilization",
    tags: ["High LTV", "High risk"],
    decision: "NO",
    decisionStatus: "Decline",
    decisionSummary:
      "Zero down on a 114% LTV with a recent charge-off and DTI of ~60% exceeds every program's limits.",
  },
];

export const SEED_APPLICANTS: ApplicantDraft[] = SPECS.map((s) => ({
  fullName: s.fullName,
  email: s.email,
  phone: s.phone,
  stage: s.stage,
  priority: s.priority,
  creditScore: s.creditScore,
  monthlyIncome: s.monthlyIncome,
  monthlyDebt: s.monthlyDebt,
  requestedAmount: s.requestedAmount,
  downPayment: s.downPayment,
  vehicle: s.vehicle,
  loanTermMonths: s.loanTermMonths,
  estimatedApr: s.estimatedApr,
  estimatedMonthlyPayment: s.estimatedMonthlyPayment,
  applicantData: buildData(s),
  tags: s.tags,
  decision: s.decision ?? null,
  decisionStatus: s.decisionStatus,
  decisionSummary: s.decisionSummary,
}));
