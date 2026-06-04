import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./auth/AuthContext";
import AuthScreen from "./auth/AuthScreen";
import CreateModal from "./create/CreateModal";
import {
  APPLICANTS,
  RULES,
  clearCollection,
  listenApplicants,
  listenRules,
  seedApplicants,
  seedRules,
  setApplicantStage,
} from "./db";
import { avatarColor, initials } from "./format";
import ApplicantCard from "./kanban/ApplicantCard";
import ApplicantDetail from "./kanban/ApplicantDetail";
import KanbanBoard from "./kanban/KanbanBoard";
import { SEED_APPLICANTS, SEED_RULES } from "./seedData";
import type { Applicant, Stage, UnderwritingRule, UserProfile } from "./types";

const SEED_FLAG = "lyzr_seeded_v1";

export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <div className="loading-pulse" />
        <span>Connecting…</span>
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  if (!profile) return <AuthScreen needsProfile />;
  return <Dashboard profile={profile} />;
}

function Dashboard({ profile }: { profile: UserProfile }) {
  const { signOut } = useAuth();
  const isUnderwriter = profile.role === "underwriter";

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [rules, setRules] = useState<UnderwritingRule[]>([]);
  const [applicantsLoaded, setApplicantsLoaded] = useState(false);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const seedAttempt = useRef(false);

  // Live subscriptions
  useEffect(() => {
    const unsub = listenApplicants(
      { role: profile.role, uid: profile.uid },
      (items) => {
        setApplicants(items);
        setApplicantsLoaded(true);
      },
      (e) => setListenError(e.message)
    );
    return unsub;
  }, [profile.role, profile.uid]);

  useEffect(() => {
    const unsub = listenRules(
      (items) => {
        setRules(items);
        setRulesLoaded(true);
      },
      (e) => setListenError(e.message)
    );
    return unsub;
  }, []);

  // Auto-seed the demo dataset once, on a fresh empty project (underwriter only).
  useEffect(() => {
    if (!isUnderwriter || seedAttempt.current) return;
    if (!applicantsLoaded || !rulesLoaded) return;
    if (localStorage.getItem(SEED_FLAG)) return;
    if (applicants.length === 0 && rules.length === 0) {
      seedAttempt.current = true;
      setSeeding(true);
      Promise.all([
        seedRules(SEED_RULES),
        seedApplicants(SEED_APPLICANTS.map((a) => ({ ...a, createdBy: profile.uid }))),
      ])
        .then(() => localStorage.setItem(SEED_FLAG, "1"))
        .catch((e) => setListenError(e instanceof Error ? e.message : String(e)))
        .finally(() => setSeeding(false));
    } else {
      localStorage.setItem(SEED_FLAG, "1");
    }
  }, [isUnderwriter, applicantsLoaded, rulesLoaded, applicants.length, rules.length, profile.uid]);

  // Keep the open drawer in sync with live data (e.g. when a run finishes).
  const liveSelected = useMemo(
    () => (selected ? applicants.find((a) => a.id === selected.id) ?? selected : null),
    [selected, applicants]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return applicants;
    return applicants.filter((a) =>
      [a.fullName, a.email, ...(a.tags ?? []), a.vehicle?.make, a.vehicle?.model]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(q))
    );
  }, [applicants, search]);

  const stats = useMemo(() => {
    const by = (s: Stage) => applicants.filter((a) => a.stage === s).length;
    return {
      total: applicants.length,
      review: by("new") + by("underwriting") + by("manual_review"),
      approved: by("approved") + by("conditional"),
      declined: by("declined"),
    };
  }, [applicants]);

  const onMove = (id: string, stage: Stage) => {
    setApplicantStage(id, stage).catch((e) =>
      setListenError(e instanceof Error ? e.message : String(e))
    );
  };

  const resetSampleData = async () => {
    if (!confirm("Reset the board to the sample dataset? This deletes current cards & rules.")) return;
    setMenuOpen(false);
    setSeeding(true);
    try {
      await clearCollection(APPLICANTS);
      await clearCollection(RULES);
      await seedRules(SEED_RULES);
      await seedApplicants(SEED_APPLICANTS.map((a) => ({ ...a, createdBy: profile.uid })));
      localStorage.setItem(SEED_FLAG, "1");
    } catch (e) {
      setListenError(e instanceof Error ? e.message : String(e));
    } finally {
      setSeeding(false);
    }
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

        {isUnderwriter && (
          <div className="topbar-search">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applicants, vehicles, tags…"
            />
          </div>
        )}

        <div className="topbar-right">
          <button className="btn btn-primary create-btn" onClick={() => setCreateOpen(true)}>
            <span className="plus">＋</span>
            {isUnderwriter ? "Create" : "New application"}
          </button>

          <div className="user-menu">
            <button className="user-trigger" onClick={() => setMenuOpen((v) => !v)}>
              <span className="kcard-avatar sm" style={{ ["--av" as string]: avatarColor(profile.displayName) }}>
                {initials(profile.displayName)}
              </span>
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu-pop">
                  <div className="menu-head">
                    <div className="menu-name">{profile.displayName}</div>
                    <div className="menu-email">{profile.email}</div>
                    <span className={`role-badge role-${profile.role}`}>
                      {profile.role === "underwriter" ? "Lender" : "Borrower"}
                    </span>
                  </div>
                  {isUnderwriter && (
                    <button className="menu-item" onClick={resetSampleData}>
                      Reset sample data
                    </button>
                  )}
                  <button className="menu-item danger" onClick={() => signOut()}>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="main board-main">
        <section className="board-hero">
          <div>
            <h1>
              {isUnderwriter ? "Underwriting" : "Your applications"}{" "}
              <span className="glow">pipeline.</span>
            </h1>
            <p>
              {isUnderwriter
                ? "Every applicant is a card. Drag between columns, or open one to run the agent crew and read the structured recommendation."
                : "Track each application as it moves through review. Submit a new one any time."}
            </p>
          </div>
          {isUnderwriter && (
            <div className="board-stats">
              <Stat n={stats.review} label="In review" accent="#7DEBFF" />
              <Stat n={stats.approved} label="Approved" accent="#38f5a4" />
              <Stat n={stats.declined} label="Declined" accent="#ff5b6b" />
              <Stat n={stats.total} label="Total" accent="#c4ccd6" />
            </div>
          )}
        </section>

        {listenError && (
          <div className="error">
            <strong>Connection issue</strong>
            {listenError}
          </div>
        )}

        {seeding && (
          <div className="loading">
            <div className="loading-pulse" />
            <div className="loading-text">
              <strong>Preparing the sample dataset…</strong>
              <span>Seeding applicants and underwriting rule presets into Firestore.</span>
            </div>
          </div>
        )}

        {isUnderwriter ? (
          <KanbanBoard
            applicants={filtered}
            draggable
            onOpen={setSelected}
            onMove={onMove}
          />
        ) : (
          <ApplicantPortal applicants={applicants} onOpen={setSelected} onNew={() => setCreateOpen(true)} />
        )}
      </main>

      {createOpen && (
        <CreateModal
          role={profile.role}
          uid={profile.uid}
          rules={rules}
          onClose={() => setCreateOpen(false)}
        />
      )}

      {liveSelected && (
        <ApplicantDetail
          applicant={liveSelected}
          role={profile.role}
          uid={profile.uid}
          rules={rules}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ApplicantPortal({
  applicants,
  onOpen,
  onNew,
}: {
  applicants: Applicant[];
  onOpen: (a: Applicant) => void;
  onNew: () => void;
}) {
  if (applicants.length === 0) {
    return (
      <div className="empty-state">
        <div className="glyph">❋</div>
        <div>You haven&rsquo;t submitted an application yet.</div>
        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onNew}>
          Submit an application
        </button>
      </div>
    );
  }
  return (
    <div className="portal-list">
      {applicants.map((a) => (
        <ApplicantCard
          key={a.id}
          applicant={a}
          draggable={false}
          dragging={false}
          onOpen={onOpen}
          onDragStart={() => {}}
          onDragEnd={() => {}}
        />
      ))}
    </div>
  );
}

function Stat({ n, label, accent }: { n: number; label: string; accent?: string }) {
  return (
    <div className="bstat" style={accent ? { ["--rail" as string]: accent } : undefined}>
      <span className="bstat-n">{n}</span>
      <span className="bstat-l">{label}</span>
    </div>
  );
}
