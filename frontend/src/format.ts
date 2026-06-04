// Small display helpers shared across the kanban + modals.

export function money(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** Compact currency for tight card space: $26.5k, $1.2M. */
export function compactMoney(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + Math.round(n).toLocaleString("en-US");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "#7DEBFF",
  "#8b9dff",
  "#c08bff",
  "#38f5a4",
  "#ffc46b",
  "#ff8bc0",
  "#6bd3ff",
  "#9af5d0",
];

/** Deterministic accent color from a name so each avatar is stable. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function timeAgo(ms: number | undefined): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

/** Debt-to-income after the new payment, as a percentage (or undefined). */
export function dtiPct(a: {
  monthlyIncome?: number;
  monthlyDebt?: number;
  estimatedMonthlyPayment?: number;
}): number | undefined {
  if (!a.monthlyIncome) return undefined;
  const debt = (a.monthlyDebt ?? 0) + (a.estimatedMonthlyPayment ?? 0);
  return Math.round((debt / a.monthlyIncome) * 100);
}

/** Loan-to-value as a percentage (financed amount / vehicle value). */
export function ltvPct(a: {
  requestedAmount?: number;
  vehicle?: { value?: number };
}): number | undefined {
  const v = a.vehicle?.value;
  if (!v || !a.requestedAmount) return undefined;
  return Math.round((a.requestedAmount / v) * 100);
}
