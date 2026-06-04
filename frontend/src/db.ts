// Firestore data-access layer. All reads/writes the browser does go through
// here so the rest of the app never touches the SDK directly.
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Applicant,
  ApplicantDraft,
  Decision,
  Role,
  Stage,
  UnderwritingRule,
  UnderwritingRuleDraft,
  UserProfile,
} from "./types";

export const USERS = "users";
export const APPLICANTS = "applicants";
export const RULES = "underwriting_rules";
export const JOBS = "underwriting_jobs";

// ─── helpers ────────────────────────────────────────────────────────────────

function ts(v: unknown): number | undefined {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === "number") return v;
  return undefined;
}

/** Firestore rejects `undefined` field values — strip them (recursively). */
function clean<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Timestamp || Array.isArray(obj)) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? clean(v) : v;
  }
  return out as T;
}

/** Map an orchestrator decision/status onto a kanban column. Kept in sync with
 *  the Python copy in firebase/_backend logic so the board and the backend
 *  agree on where a finished case lands. */
export function stageForDecision(
  decision: Decision | null | undefined,
  status: string | undefined
): Stage {
  const s = (status ?? "").toLowerCase();
  if (s.includes("conditional")) return "conditional";
  if (decision === "YES") return "approved";
  if (s.includes("manual") || s.includes("refer")) return "manual_review";
  return "declined";
}

// ─── users ──────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid,
    email: d.email ?? "",
    displayName: d.displayName ?? "",
    role: (d.role as Role) ?? "applicant",
    organization: d.organization ?? undefined,
    createdAt: ts(d.createdAt),
  };
}

export async function createUserProfile(p: {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  organization?: string;
}): Promise<void> {
  await setDoc(
    doc(db, USERS, p.uid),
    clean({
      email: p.email,
      displayName: p.displayName,
      role: p.role,
      organization: p.organization,
      createdAt: serverTimestamp(),
    }),
    { merge: true }
  );
}

// ─── applicants (kanban tickets) ──────────────────────────────────────────────

function applicantFromDoc(id: string, d: Record<string, any>): Applicant {
  return {
    id,
    fullName: d.fullName ?? "Unnamed applicant",
    email: d.email ?? undefined,
    phone: d.phone ?? undefined,
    stage: (d.stage as Stage) ?? "new",
    priority: d.priority ?? "medium",
    assignedTo: d.assignedTo ?? undefined,
    creditScore: d.creditScore ?? undefined,
    monthlyIncome: d.monthlyIncome ?? undefined,
    monthlyDebt: d.monthlyDebt ?? undefined,
    requestedAmount: d.requestedAmount ?? undefined,
    downPayment: d.downPayment ?? undefined,
    vehicle: d.vehicle ?? undefined,
    loanTermMonths: d.loanTermMonths ?? undefined,
    estimatedApr: d.estimatedApr ?? undefined,
    estimatedMonthlyPayment: d.estimatedMonthlyPayment ?? undefined,
    applicantData: d.applicantData ?? "",
    linkedUserId: d.linkedUserId ?? undefined,
    createdBy: d.createdBy ?? undefined,
    rulesId: d.rulesId ?? undefined,
    latestJobId: d.latestJobId ?? undefined,
    decision: (d.decision as Decision) ?? null,
    decisionStatus: d.decisionStatus ?? undefined,
    decisionSummary: d.decisionSummary ?? undefined,
    tags: d.tags ?? undefined,
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  };
}

/** Attach an onSnapshot that self-heals from transient `permission-denied`
 *  errors. Right after a brand-new account is created, a security-rule `get()`
 *  on the just-written users/{uid} doc can momentarily fail before the new auth
 *  session is fully propagated — and onSnapshot otherwise dies permanently on
 *  that first error. We re-subscribe a few times with backoff; once the session
 *  settles the listener attaches normally. Non-permission errors surface
 *  immediately. */
function resilientSnapshot<T>(
  makeQuery: () => ReturnType<typeof query>,
  map: (snap: any) => T,
  cb: (v: T) => void,
  onErr?: (e: Error) => void
): Unsubscribe {
  let active = true;
  let attempts = 0;
  let inner: Unsubscribe = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  const attach = () => {
    inner = onSnapshot(
      makeQuery(),
      (snap) => {
        attempts = 0;
        cb(map(snap));
      },
      (e: any) => {
        if (active && e?.code === "permission-denied" && attempts < 5) {
          attempts += 1;
          inner();
          timer = setTimeout(() => active && attach(), 500 * attempts);
        } else if (active) {
          onErr?.(e as Error);
        }
      }
    );
  };
  attach();

  return () => {
    active = false;
    if (timer) clearTimeout(timer);
    inner();
  };
}

/** Live subscription to the board. Underwriters see every card; applicants see
 *  only cards linked to their uid. Sorted newest-first client-side so we don't
 *  need composite indexes. */
export function listenApplicants(
  opts: { role: Role; uid: string },
  cb: (items: Applicant[]) => void,
  onErr?: (e: Error) => void
): Unsubscribe {
  const col = collection(db, APPLICANTS);
  return resilientSnapshot(
    () =>
      opts.role === "underwriter"
        ? query(col)
        : query(col, where("linkedUserId", "==", opts.uid)),
    (snap) => {
      const items = snap.docs.map((s: any) => applicantFromDoc(s.id, s.data()));
      items.sort((a: Applicant, b: Applicant) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      return items;
    },
    cb,
    onErr
  );
}

export async function createApplicant(draft: ApplicantDraft): Promise<string> {
  const ref = doc(collection(db, APPLICANTS));
  await setDoc(
    ref,
    clean({ ...draft, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
  );
  return ref.id;
}

export async function updateApplicant(
  id: string,
  patch: Partial<Applicant>
): Promise<void> {
  await updateDoc(
    doc(db, APPLICANTS, id),
    clean({ ...patch, updatedAt: serverTimestamp() }) as Record<string, unknown>
  );
}

export async function setApplicantStage(id: string, stage: Stage): Promise<void> {
  await updateDoc(doc(db, APPLICANTS, id), { stage, updatedAt: serverTimestamp() });
}

export async function deleteApplicant(id: string): Promise<void> {
  await deleteDoc(doc(db, APPLICANTS, id));
}

// ─── underwriting rules (presets) ─────────────────────────────────────────────

function ruleFromDoc(id: string, d: Record<string, any>): UnderwritingRule {
  return {
    id,
    name: d.name ?? "Untitled policy",
    description: d.description ?? "",
    body: d.body ?? "",
    category: d.category ?? undefined,
    isDefault: d.isDefault ?? false,
    createdBy: d.createdBy ?? undefined,
    createdAt: ts(d.createdAt),
  };
}

export function listenRules(
  cb: (items: UnderwritingRule[]) => void,
  onErr?: (e: Error) => void
): Unsubscribe {
  return resilientSnapshot(
    () => query(collection(db, RULES)),
    (snap) => {
      const items = snap.docs.map((s: any) => ruleFromDoc(s.id, s.data()));
      items.sort((a: UnderwritingRule, b: UnderwritingRule) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return items;
    },
    cb,
    onErr
  );
}

export async function createRule(draft: UnderwritingRuleDraft): Promise<string> {
  const ref = doc(collection(db, RULES));
  await setDoc(ref, clean({ ...draft, createdAt: serverTimestamp() }));
  return ref.id;
}

// ─── seeding (demo data) ──────────────────────────────────────────────────────

export async function collectionIsEmpty(name: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, name), limit(1)));
  return snap.empty;
}

export async function seedRules(rules: UnderwritingRuleDraft[]): Promise<void> {
  const batch = writeBatch(db);
  for (const r of rules) {
    batch.set(doc(collection(db, RULES)), clean({ ...r, createdAt: serverTimestamp() }));
  }
  await batch.commit();
}

export async function seedApplicants(items: ApplicantDraft[]): Promise<void> {
  const batch = writeBatch(db);
  for (const a of items) {
    batch.set(
      doc(collection(db, APPLICANTS)),
      clean({ ...a, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
    );
  }
  await batch.commit();
}

// ─── underwriting jobs (read-only from the client) ───────────────────────────
// The browser never writes jobs (the backend admin SDK owns that). We only read
// a finished job's stored result to show full subagent findings in the drawer.

export async function getJobResult(
  jobId: string
): Promise<Record<string, any> | null> {
  const snap = await getDoc(doc(db, JOBS, jobId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return d.status === "done" ? (d.result ?? null) : null;
}

export type JobStatus = "pending" | "running" | "done" | "error" | "missing";

export interface JobSnapshot {
  status: JobStatus;
  /** Parsed UnderwriteResponse once `done`. */
  result?: Record<string, any> | null;
  /** Failure detail once `error`. */
  detail?: string;
  createdAt?: number;
}

/** Live subscription to a single underwriting job. The backend Cloud Function
 *  (firebase/main.py `process_job`) writes the status transitions
 *  pending → running → done|error and the final result onto this doc; the
 *  browser only reads. The loading view watches this instead of HTTP-polling
 *  the backend `/api/jobs/{id}` endpoint — a long poll across the ~4-minute run
 *  can 500 on cold starts, whereas this realtime listener simply rides the
 *  backend's own Firestore writes. */
export function listenJob(
  jobId: string,
  cb: (job: JobSnapshot) => void,
  onErr?: (e: Error) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, JOBS, jobId),
    (snap: any) => {
      if (!snap.exists()) {
        cb({ status: "missing" });
        return;
      }
      const d = snap.data() as Record<string, any>;
      cb({
        status: (d.status as JobStatus) ?? "pending",
        result: d.result ?? null,
        detail: typeof d.detail === "string" ? d.detail : undefined,
        createdAt: ts(d.created_at) ?? ts(d.createdAt),
      });
    },
    (e: any) => onErr?.(e as Error)
  );
}

/** Delete every doc in a collection (used by "Reset sample data"). Firestore
 *  has no truncate, so we read ids and batch-delete. Fine at demo scale. */
export async function clearCollection(name: string): Promise<void> {
  const snap = await getDocs(collection(db, name));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
