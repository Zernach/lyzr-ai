import { useState, type FormEvent } from "react";
import type { Role } from "../types";
import { authErrorMessage, useAuth } from "./AuthContext";

type Mode = "signin" | "register";

interface RoleTheme {
  /** Card / badge label. */
  label: string;
  /** First-person line shown on the chooser cards. */
  who: string;
  glyph: string;
  accent: string;
  /** Audience-card pitch bullets (hero + chooser). */
  points: string[];
  /** Call-to-action on the audience/chooser card. */
  cta: string;
  formTitle: string;
  formSub: string;
  emailLabel: string;
  submit: string;
}

/** The two audiences. Underwriters are arctic-cyan; applicants are violet — the
 *  same color language the dashboard already uses for role badges. Selecting a
 *  path re-themes the entire form and routes into a distinct sign-up flow. */
const ROLE_THEME: Record<Role, RoleTheme> = {
  underwriter: {
    label: "Underwriting team",
    who: "I review & decide auto-loan applications",
    glyph: "◆",
    accent: "#7DEBFF",
    points: [
      "Run an agent crew on every file in seconds",
      "Drag-and-drop pipeline from intake to funded",
      "Consistent, explainable, audit-ready decisions",
    ],
    cta: "Set up a team workspace",
    formTitle: "Create your team workspace",
    formSub: "For underwriters, credit analysts & lending staff.",
    emailLabel: "Work email",
    submit: "Create workspace",
  },
  applicant: {
    label: "Loan applicant",
    who: "I'm applying for an auto loan",
    glyph: "◇",
    accent: "#c08bff",
    points: [
      "Apply in minutes from any device",
      "Track your decision status in real time",
      "Clear, fast answers — never a black box",
    ],
    cta: "Apply for a loan",
    formTitle: "Create your applicant account",
    formSub: "Apply once, then track everything in one place.",
    emailLabel: "Email",
    submit: "Create account",
  },
};

const ROLES: Role[] = ["underwriter", "applicant"];

/** Shown when nobody is signed in, OR when a signed-in user has no profile doc
 *  yet (the "complete profile" path). A side-by-side experience: a dual-audience
 *  hero on the left, and a sign-in / branching sign-up panel on the right. */
export default function AuthScreen({
  needsProfile = false,
}: {
  needsProfile?: boolean;
}) {
  const { signIn, register, completeProfile } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  /** null while the user is still choosing which sign-up path to take. */
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegister = needsProfile || mode === "register";
  const theme = role ? ROLE_THEME[role] : null;
  // The hero highlights whichever audience the right panel is currently on.
  const activeRole = isRegister ? role : null;

  const pickPath = (r: Role) => {
    if (!needsProfile) setMode("register");
    setRole(r);
    setError(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isRegister && !role) return; // still on the chooser
    setBusy(true);
    setError(null);
    try {
      if (needsProfile) {
        await completeProfile({ displayName, role: role!, organization });
      } else if (mode === "register") {
        await register({ email, password, displayName, role: role!, organization });
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const showTabs = !needsProfile && role === null;
  const choosing = isRegister && role === null;

  return (
    <div className="auth-page">
      <div className="auth-fx" aria-hidden>
        <span className="fx-aurora" />
        <span className="fx-grid" />
        <LyzrField />
      </div>

      <div className="auth-split">
        <Hero activeRole={activeRole} onPick={pickPath} />

        <div className="auth-panel">
          <form
            className="auth-card"
            onSubmit={onSubmit}
            style={theme ? { ["--accent" as string]: theme.accent } : undefined}
          >
            {showTabs && (
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${mode === "signin" ? "is-active" : ""}`}
                  onClick={() => {
                    setMode("signin");
                    setRole(null);
                    setError(null);
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
                  onClick={() => {
                    setMode("register");
                    setRole(null);
                    setError(null);
                  }}
                >
                  Create account
                </button>
              </div>
            )}

            {/* ── Sign in ────────────────────────────────────────────────── */}
            {!needsProfile && mode === "signin" && (
              <>
                <div className="auth-head">
                  <h2>Welcome back</h2>
                  <p>Sign in to pick up where you left off.</p>
                </div>
                <label className="auth-field">
                  <span>Email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </label>
                {error && <div className="auth-error">{error}</div>}
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <div className="auth-foot">
                  New here?{" "}
                  <button type="button" onClick={() => pickPath("underwriter")}>
                    Create an account
                  </button>
                </div>
              </>
            )}

            {/* ── Choose a sign-up path ──────────────────────────────────── */}
            {choosing && (
              <>
                <div className="auth-head">
                  <h2>{needsProfile ? "Finish your profile" : "Create your account"}</h2>
                  <p>
                    {needsProfile
                      ? "Tell us how you'll use Lyzr — this tailors your whole experience."
                      : "Pick the path that fits you. Each is a distinct, tailored experience."}
                  </p>
                </div>
                <div className="path-grid">
                  {ROLES.map((r) => {
                    const t = ROLE_THEME[r];
                    return (
                      <button
                        key={r}
                        type="button"
                        className="path-card"
                        style={{ ["--accent" as string]: t.accent }}
                        onClick={() => pickPath(r)}
                      >
                        <span className="path-glyph">{t.glyph}</span>
                        <span className="path-label">{t.label}</span>
                        <span className="path-who">{t.who}</span>
                        <span className="path-cta">
                          {t.cta} <span className="arr">→</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {!needsProfile && (
                  <div className="auth-foot">
                    Already have an account?{" "}
                    <button type="button" onClick={() => setMode("signin")}>
                      Sign in
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ── Tailored sign-up form (per audience) ───────────────────── */}
            {isRegister && theme && (
              <>
                <button
                  type="button"
                  className="auth-back"
                  onClick={() => {
                    setRole(null);
                    setError(null);
                  }}
                >
                  ← {needsProfile ? "Choose a different type" : "All account types"}
                </button>

                <div className="auth-pathbadge">
                  <span className="path-glyph">{theme.glyph}</span>
                  {theme.label}
                </div>

                <div className="auth-head">
                  <h2>{needsProfile ? "Finish setting up your profile" : theme.formTitle}</h2>
                  <p>{theme.formSub}</p>
                </div>

                <label className="auth-field">
                  <span>Full name</span>
                  <input
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={role === "underwriter" ? "Dana Underwriter" : "Alex Applicant"}
                    required
                  />
                </label>

                {!needsProfile && (
                  <>
                    <label className="auth-field">
                      <span>{theme.emailLabel}</span>
                      <input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={role === "underwriter" ? "you@lender.com" : "you@email.com"}
                        required
                      />
                    </label>
                    <label className="auth-field">
                      <span>Password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                      />
                    </label>
                  </>
                )}

                {role === "underwriter" && (
                  <label className="auth-field">
                    <span>
                      Organization <em className="optional">(optional)</em>
                    </span>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="Arctic Capital Auto Finance"
                    />
                  </label>
                )}

                {error && <div className="auth-error">{error}</div>}

                <button className="auth-submit" disabled={busy}>
                  {busy ? "Working…" : needsProfile ? "Finish setup" : theme.submit}
                </button>
              </>
            )}
          </form>

          <p className="auth-legal">
            Decision support only — final lending decisions rest with a licensed
            underwriter. Your data is encrypted in transit and at rest.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Ambient background, drawn from the Lyzr mark's geometry: a slow-drifting
 *  field of angular glyphs — diagonal slashes, open chevrons, ticks — layered at
 *  different depths over a faint, twinkling constellation. Inline SVG so the
 *  strokes stay crisp at any size; all motion is gentle and loops seamlessly. */
const FIELD_GLYPHS: {
  id: "gly-slash" | "gly-chev" | "gly-tick";
  x: number;
  y: number;
  s: number;
  r: number;
  o: number;
  cls: string;
  glow: "cy" | "vi";
}[] = [
  { id: "gly-slash", x: 150, y: 190, s: 240, r: 14, o: 0.24, cls: "gl-1", glow: "cy" },
  { id: "gly-chev", x: 1240, y: 250, s: 170, r: -10, o: 0.19, cls: "gl-2", glow: "vi" },
  { id: "gly-tick", x: 300, y: 700, s: 120, r: 8, o: 0.22, cls: "gl-3", glow: "cy" },
  { id: "gly-slash", x: 1110, y: 680, s: 180, r: -24, o: 0.16, cls: "gl-4", glow: "vi" },
  { id: "gly-chev", x: 560, y: 120, s: 132, r: 12, o: 0.15, cls: "gl-5", glow: "cy" },
  { id: "gly-tick", x: 830, y: 520, s: 150, r: -6, o: 0.13, cls: "gl-6", glow: "cy" },
  { id: "gly-slash", x: 36, y: 560, s: 150, r: 30, o: 0.16, cls: "gl-7", glow: "vi" },
];

/** Shared stroke presentation for every glyph polyline. */
const STROKE = {
  fill: "none",
  stroke: "url(#lyzrStroke)",
  strokeWidth: 5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

function LyzrField() {
  return (
    <svg
      className="fx-field"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="lyzrStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7DEBFF" />
          <stop offset="100%" stopColor="#c08bff" />
        </linearGradient>
        {/* Diagonal slash + top-right corner bracket — the mark's signature. */}
        <symbol id="gly-slash" viewBox="0 0 100 100">
          <polyline points="14,86 86,14" {...STROKE} />
          <polyline points="58,14 86,14 86,42" {...STROKE} />
        </symbol>
        {/* Open chevron. */}
        <symbol id="gly-chev" viewBox="0 0 100 100">
          <polyline points="34,18 72,50 34,82" {...STROKE} />
        </symbol>
        {/* Angular tick. */}
        <symbol id="gly-tick" viewBox="0 0 100 100">
          <polyline points="22,52 42,72 78,26" {...STROKE} />
        </symbol>
      </defs>

      <g className="net">
        <line x1="150" y1="190" x2="560" y2="120" />
        <line x1="560" y1="120" x2="830" y2="520" />
        <line x1="830" y1="520" x2="300" y2="700" />
        <line x1="830" y1="520" x2="1240" y2="250" />
        <line x1="1240" y1="250" x2="1110" y2="680" />
        <circle cx="150" cy="190" r="3.5" />
        <circle cx="560" cy="120" r="3" />
        <circle cx="830" cy="520" r="4" />
        <circle cx="300" cy="700" r="3" />
        <circle cx="1240" cy="250" r="3.5" />
        <circle cx="1110" cy="680" r="3" />
      </g>

      {FIELD_GLYPHS.map((g, i) => (
        <g key={i} transform={`translate(${g.x} ${g.y}) rotate(${g.r})`} opacity={g.o}>
          <g className={`gl ${g.cls} ${g.glow}`}>
            <use href={`#${g.id}`} x={-g.s / 2} y={-g.s / 2} width={g.s} height={g.s} />
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Left side: the dual-audience pitch. The two audience cards are interactive —
 *  clicking one routes the right panel straight into that sign-up flow. */
function Hero({
  activeRole,
  onPick,
}: {
  activeRole: Role | null;
  onPick: (r: Role) => void;
}) {
  return (
    <div className="auth-hero">
      <div className="hero-brand">
        <img src="/lyzr-icon.png" alt="Lyzr" className="hero-mark" />
        <div>
          <div className="hero-brandname">Lyzr Underwriting Copilot</div>
          <div className="hero-eyebrow">Auto Loan · Agentic Decision Support</div>
        </div>
      </div>

      <h1 className="hero-head">
        Auto-loan decisions,
        <br />
        <span className="grad">accelerated by agentic AI.</span>
      </h1>

      <p className="hero-lede">
        Lyzr reads every application, applies your policy with a crew of
        specialized agents, and returns a structured, explainable decision —
        faster for your team, clearer for your applicants.
      </p>

      <div className="hero-auds">
        {ROLES.map((r) => {
          const t = ROLE_THEME[r];
          const dim = activeRole !== null && activeRole !== r;
          return (
            <button
              key={r}
              type="button"
              className={`aud-card ${activeRole === r ? "is-active" : ""} ${
                dim ? "is-dim" : ""
              }`}
              style={{ ["--accent" as string]: t.accent }}
              onClick={() => onPick(r)}
            >
              <div className="aud-top">
                <span className="aud-glyph">{t.glyph}</span>
                <span className="aud-for">
                  {r === "underwriter" ? "For underwriting teams" : "For loan applicants"}
                </span>
              </div>
              <ul className="aud-points">
                {t.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <span className="aud-cta">
                {t.cta} <span className="arr">→</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="hero-strip">
        <span>
          <b>Seconds</b>, not days
        </span>
        <span className="hero-dot" />
        <span>Explainable by design</span>
        <span className="hero-dot" />
        <span>End-to-end encrypted</span>
      </div>
    </div>
  );
}
