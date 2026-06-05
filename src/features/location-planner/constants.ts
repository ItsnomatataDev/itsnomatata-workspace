export const PLANNER_COLORS = {
  black: "#050505",
  orange: "#f97316",
  white: "#ffffff",
  border: "#e5e7eb",
  muted: "#6b7280",
} as const;

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  activity_site: "Activity Site",
  office: "Office",
  department: "Department",
  team: "Team",
  other: "Other",
};

export const LOCATION_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  closed: "Closed",
  limited: "Limited",
};

export const DRAG_EMPLOYEE = "planner-employee";

/** Black-first Location Planner surfaces (matches Codex dashboard). */
export const plannerPanel =
  "rounded-2xl border border-white/10 bg-white/5";
export const plannerCard =
  "rounded-xl border border-white/10 bg-black/60";
export const plannerCardSelected =
  "rounded-xl border border-orange-500 ring-2 ring-orange-500/25 bg-black/80";
export const plannerMuted = "text-white/55";
export const plannerHeading = "text-white";
export const plannerInput =
  "w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-400/70";
export const plannerSelect =
  "rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-400/70";
export const plannerBtnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600";
export const plannerBtnSecondary =
  "inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-orange-400/60 hover:text-white";
export const plannerDropzone =
  "rounded-lg border border-dashed border-white/15 bg-black/40 px-3 py-4 text-center text-xs text-white/50";
export const plannerDropzoneActive =
  "rounded-lg border border-dashed border-orange-500 bg-orange-500/10 px-3 py-4 text-center text-xs text-orange-300";

export const EDITOR_ROLES = new Set([
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
]);
