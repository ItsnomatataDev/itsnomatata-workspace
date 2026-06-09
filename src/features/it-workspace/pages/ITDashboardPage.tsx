import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Bug,
  Sparkles,
  Activity,
  ArrowRight,
  CheckSquare,
  Clock3,
  Database,
  Lock,
  Shield,
  Siren,
  KeyRound,
  UserX,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import ITStatsCard from "../components/ITStatsCard";
import InviteMemberModal from "../components/InviteMemberModal";
import CrossModuleHealthGrid from "../components/CrossModuleHealthGrid";
import TeamPulseStrip from "../components/TeamPulseStrip";
import EscalationFeed from "../components/EscalationFeed";
import AIInsightsPanel from "../components/AIInsightsPanel";
import AIQuickActions from "../components/AIQuickActions";
import KPITilesRow from "../components/KPITilesRow";
import SupportTicketsFeed from "../components/SupportTicketsFeed";
import { useDashboard } from "../../../lib/hooks/useDashboard";
import {
  getITDashboardStats,
  type ITDashboardStats,
} from "../services/itWorkspaceService";
import {
  getCrossModuleHealth,
  getTeamPulse,
  getEscalationItems,
  getKPITiles,
  type ModuleHealthItem,
  type TeamPulseMember,
  type EscalationItem,
  type KPITile,
} from "../services/controlCentreService";
import {
  getSupportTickets,
  type SupportTicket,
} from "../services/supportTicketService";
import {
  createIncident,
  getAccountAccessRequests,
  getAuditLogs,
  getIncidents,
  getSystemHealth,
  reviewAccountAccessRequest,
  type AccountAccessRequest,
  type AuditLogRow,
  type IncidentRow,
  type SystemHealthResponse,
} from "../services/warRoomService";

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function EnvStatus({
  label,
  configured,
}: {
  label: string;
  configured: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-4 py-3">
      <span className="text-sm text-white/70">{label}</span>
      <span
        className={[
          "rounded-full px-3 py-1 text-xs font-semibold",
          configured
            ? "bg-emerald-500/10 text-emerald-300"
            : "bg-amber-500/10 text-amber-300",
        ].join(" ")}
      >
        {configured ? "Configured" : "Setup required"}
      </span>
    </div>
  );
}

export default function ITDashboardPage() {
  const auth = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [modules, setModules] = useState<ModuleHealthItem[]>([]);
  const [teamPulse, setTeamPulse] = useState<TeamPulseMember[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [kpis, setKpis] = useState<KPITile[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthResponse | null>(null);
  const [accountRequests, setAccountRequests] = useState<AccountAccessRequest[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [incidentSeverity, setIncidentSeverity] =
    useState<IncidentRow["severity"]>("medium");
  const [warRoomBusy, setWarRoomBusy] = useState(false);

  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const loading = auth?.loading ?? true;

  const firstName = useMemo(() => {
    const fullName =
      profile?.display_name ||
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "User";

    return String(fullName).split(" ")[0];
  }, [profile?.display_name, profile?.full_name, user?.user_metadata?.full_name, user?.email]);

  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? undefined;
  const cityLabel =
    typeof profile?.department === "string" &&
    profile.department.trim().length > 0
      ? profile.department
      : "Your city";

  const sharedDashboard = useDashboard({
    userId,
    organizationId,
    role: profile?.primary_role ?? null,
    cityLabel,
    latitude: null,
    longitude: null,
    enabled: !!organizationId && !!userId,
  });

  const loadDashboard = useCallback(async () => {
    if (!organizationId || !userId) return;

    try {
      setPageLoading(true);
      setPageError("");

      const [
        statsResult,
        modulesResult,
        pulseResult,
        escalationsResult,
        kpisResult,
        ticketsResult,
        healthResult,
        accountRequestsResult,
        incidentsResult,
        auditLogsResult,
      ] = await Promise.all([
        getITDashboardStats(organizationId),
        getCrossModuleHealth(organizationId),
        getTeamPulse(organizationId),
        getEscalationItems(organizationId),
        getKPITiles(organizationId),
        getSupportTickets(organizationId, {
          status: ["open", "in_progress", "waiting_on_user"],
          limit: 8,
        }),
        getSystemHealth().catch(() => null),
        getAccountAccessRequests(organizationId),
        getIncidents(organizationId),
        getAuditLogs(organizationId),
      ]);

      setStats(statsResult);
      setModules(modulesResult);
      setTeamPulse(pulseResult);
      setEscalations(escalationsResult);
      setKpis(kpisResult);
      setSupportTickets(ticketsResult);
      setSystemHealth(healthResult);
      setAccountRequests(accountRequestsResult);
      setIncidents(incidentsResult);
      setAuditLogs(auditLogsResult);
    } catch (err: any) {
      console.error("IT DASHBOARD LOAD ERROR:", err);
      setPageError(err?.message || "Failed to load IT dashboard.");
    } finally {
      setPageLoading(false);
    }
  }, [organizationId, userId]);

  const pendingAccountRequests = accountRequests.filter(
    (request) => request.status === "pending",
  );

  const reviewRequest = async (
    request: AccountAccessRequest,
    status: "approved" | "rejected",
  ) => {
    if (!organizationId || !userId) return;
    const notes = window.prompt(
      status === "approved"
        ? "Approval notes (optional)"
        : "Rejection reason (optional)",
    );
    try {
      setWarRoomBusy(true);
      await reviewAccountAccessRequest({
        requestId: request.id,
        organizationId,
        reviewerId: userId,
        status,
        notes,
      });
      await loadDashboard();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to review account request.");
    } finally {
      setWarRoomBusy(false);
    }
  };

  const submitIncident = async () => {
    if (!organizationId || !userId || !incidentTitle.trim()) return;
    try {
      setWarRoomBusy(true);
      await createIncident({
        organizationId,
        title: incidentTitle,
        severity: incidentSeverity,
        description: incidentDescription,
        createdBy: userId,
      });
      setIncidentTitle("");
      setIncidentDescription("");
      setIncidentSeverity("medium");
      await loadDashboard();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to create incident.");
    } finally {
      setWarRoomBusy(false);
    }
  };
  useEffect(() => {
    if (!organizationId || !userId) return;
    void loadDashboard();
  }, [organizationId, userId, loadDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading IT dashboard...
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Unable to load your IT workspace.
      </div>
    );
  }

  if (!organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Your IT account is missing organization or user context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar
          role={profile.primary_role}
          counts={{
            projects: stats?.activeProjects ?? 0,
            boards: stats?.totalBoards ?? 0,
            openCards: stats?.openCards ?? 0,
            pendingInvites: stats?.pendingInvites ?? 0,
            openIssues: stats?.openIssues ?? 0,
          }}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* ── Header ──────────────────────────────────── */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-orange-500" />
                <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                  Control Centre
                </p>
              </div>
              <h1 className="mt-2 text-3xl font-bold">
                Welcome back, {firstName}
              </h1>
              <p className="mt-2 text-sm text-white/50">
                AI-powered operational command centre — systems, people, and
                actions at a glance.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setInviteOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Invite Member
              </button>
              <a
                href="/boards"
                className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
              >
                Open Boards
              </a>
            </div>
          </div>

          {pageLoading ? (
            <div className="space-y-4">
              <CrossModuleHealthGrid modules={[]} loading />
              <KPITilesRow kpis={[]} loading />
              <TeamPulseStrip members={[]} loading />
            </div>
          ) : pageError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {pageError}
            </div>
          ) : (
            <>
              {/* ── 1. Cross-Module Health Grid ─────────── */}
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-medium text-white/60">
                    Critical Alerts
                  </h2>
                  <span className="text-[10px] text-white/30">
                    War Room security and platform signals
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white/60">System Health</p>
                      <Database size={18} className="text-orange-400" />
                    </div>
                    <p className="mt-4 text-3xl font-bold">
                      {systemHealth?.ok ? "OK" : "Review"}
                    </p>
                    <p className="mt-2 text-sm text-white/45">
                      {systemHealth?.warnings.length
                        ? `${systemHealth.warnings.length} warning(s)`
                        : "No protected health warnings returned"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white/60">Account Requests</p>
                      <Lock size={18} className="text-orange-400" />
                    </div>
                    <p className="mt-4 text-3xl font-bold">
                      {pendingAccountRequests.length}
                    </p>
                    <p className="mt-2 text-sm text-white/45">
                      Pending owner/admin review
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-neutral-950 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white/60">Open Incidents</p>
                      <Siren size={18} className="text-orange-400" />
                    </div>
                    <p className="mt-4 text-3xl font-bold">
                      {incidents.filter((item) => item.status !== "resolved").length}
                    </p>
                    <p className="mt-2 text-sm text-white/45">
                      Active operational incidents
                    </p>
                  </div>
                </div>
                {systemHealth?.warnings.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    {systemHealth.warnings.slice(0, 4).join(" ")}
                  </div>
                ) : null}
              </section>

              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-medium text-white/60">
                    System Health
                  </h2>
                  <span className="text-[10px] text-white/30">
                    Click any module to drill in
                  </span>
                </div>
                <CrossModuleHealthGrid modules={modules} />
              </section>

              {/* ── 2. KPI Tiles ────────────────────────── */}
              <section className="mb-6">
                <KPITilesRow kpis={kpis} />
              </section>

              {/* ── 3. Team Pulse ───────────────────────── */}
              <section className="mb-6">
                <TeamPulseStrip members={teamPulse} />
              </section>

              {/* ── 4. Core Stats Row ──────────────────── */}
              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-7">
                <ITStatsCard
                  title="Boards / Clients"
                  value={stats?.totalBoards ?? 0}
                  subtitle="Workspace boards"
                  icon={BriefcaseBusiness}
                />
                <ITStatsCard
                  title="Open Cards"
                  value={stats?.openCards ?? 0}
                  subtitle="Cards under boards"
                  icon={CheckSquare}
                />
                <ITStatsCard
                  title="Open Issues"
                  value={stats?.openIssues ?? 0}
                  subtitle="Open and in-progress"
                  icon={Bug}
                />
                <ITStatsCard
                  title="Automations"
                  value={stats?.automationCount ?? 0}
                  subtitle="Runs (24h)"
                  icon={Sparkles}
                />
                <ITStatsCard
                  title="Tracking Now"
                  value={stats?.activeTimers ?? 0}
                  subtitle="Running task timers"
                  icon={Clock3}
                />
                <ITStatsCard
                  title="System Health"
                  value={stats?.systemHealthLabel ?? "Unknown"}
                  subtitle="Automation failure state"
                  icon={Activity}
                />
                <ITStatsCard
                  title="My Cards"
                  value={sharedDashboard.stats?.openTasks ?? 0}
                  subtitle="Assigned cards"
                  icon={CheckSquare}
                />
                <ITStatsCard
                  title="Tracked Today"
                  value={`${(sharedDashboard.stats as any)?.todayMinutes ?? 0}m`}
                  subtitle="Time tracked"
                  icon={Clock3}
                />
              </section>

              {/* ── 5. Main Grid: Escalations + AI ─────── */}
              <section className="mb-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Account Requests</h2>
                      <p className="text-sm text-white/45">
                        Public access requests awaiting approval.
                      </p>
                    </div>
                    <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs text-orange-300">
                      {pendingAccountRequests.length} pending
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pendingAccountRequests.length === 0 ? (
                      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
                        No pending account requests.
                      </p>
                    ) : (
                      pendingAccountRequests.slice(0, 5).map((request) => (
                        <div key={request.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{request.full_name}</p>
                              <p className="text-sm text-white/50">{request.email}</p>
                              <p className="mt-1 text-xs text-white/40">
                                {request.company || "No company"} · {request.requested_role || "No role requested"}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                disabled={warRoomBusy}
                                onClick={() => void reviewRequest(request, "approved")}
                                className="rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-60"
                              >
                                Approve
                              </button>
                              <button
                                disabled={warRoomBusy}
                                onClick={() => void reviewRequest(request, "rejected")}
                                className="rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-60"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                          {request.message ? (
                            <p className="mt-3 text-sm text-white/60">{request.message}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Incident Console</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Create and monitor operational incidents.
                  </p>
                  <div className="mt-4 grid gap-3">
                    <input
                      value={incidentTitle}
                      onChange={(event) => setIncidentTitle(event.target.value)}
                      placeholder="Incident title"
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                    <select
                      value={incidentSeverity}
                      onChange={(event) =>
                        setIncidentSeverity(event.target.value as IncidentRow["severity"])
                      }
                      className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                    <textarea
                      value={incidentDescription}
                      onChange={(event) => setIncidentDescription(event.target.value)}
                      placeholder="Description"
                      rows={3}
                      className="resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                    <button
                      disabled={warRoomBusy || !incidentTitle.trim()}
                      onClick={() => void submitIncident()}
                      className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                    >
                      Create Incident
                    </button>
                  </div>
                  <div className="mt-5 space-y-2">
                    {incidents.slice(0, 4).map((incident) => (
                      <div key={incident.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <div className="flex justify-between gap-3">
                          <p className="text-sm font-semibold">{incident.title}</p>
                          <span className="text-xs text-orange-300">{incident.severity}</span>
                        </div>
                        <p className="mt-1 text-xs text-white/45">{incident.status}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Automations / n8n</h2>
                  <div className="mt-4 space-y-3">
                    <EnvStatus
                      label="AI Workspace webhook"
                      configured={Boolean(import.meta.env.VITE_N8N_AI_WORKSPACE_WEBHOOK_URL)}
                    />
                    <EnvStatus
                      label="Notification webhook"
                      configured={Boolean(import.meta.env.VITE_N8N_NOTIFICATION_WEBHOOK_URL)}
                    />
                    <EnvStatus
                      label="System health webhook"
                      configured={Boolean(import.meta.env.VITE_N8N_SYSTEM_HEALTH_WEBHOOK_URL)}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold">Audit Logs</h2>
                  <div className="mt-4 space-y-2">
                    {auditLogs.slice(0, 7).map((log) => (
                      <div key={log.id} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                        <p className="text-sm font-semibold text-white/80">{log.action}</p>
                        <p className="mt-1 text-xs text-white/40">
                          {formatDateTime(log.created_at)}
                          {log.reason ? ` · ${log.reason}` : ""}
                        </p>
                      </div>
                    ))}
                    {auditLogs.length === 0 ? (
                      <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
                        No audit logs returned.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-6 xl:grid-cols-3">
                {/* Left: Escalation Feed */}
                <div className="space-y-6 xl:col-span-2">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-medium text-white/60">
                        Escalations & Alerts
                      </h2>
                      <span className="text-[10px] text-white/30">
                        {escalations.length} items requiring attention
                      </span>
                    </div>
                    <EscalationFeed items={escalations} />
                  </div>

                  {/* AI Insights Panel */}
                  <AIInsightsPanel
                    organizationId={organizationId}
                    userId={userId}
                    role={profile.primary_role ?? "employee"}
                    userName={profile.display_name ?? profile.full_name ?? null}
                    modules={modules}
                    escalations={escalations}
                    kpis={kpis}
                  />
                </div>

                {/* Right: AI Quick Actions + Manual Quick Actions */}
                <div className="space-y-6">
                  <AIQuickActions
                    organizationId={organizationId}
                    userId={userId}
                    role={profile.primary_role ?? "employee"}
                    fullName={profile.display_name ?? profile.full_name ?? null}
                    email={user.email ?? ""}
                  />

                  <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/10 to-white/5 p-5">
                    <h2 className="text-sm font-semibold text-white">
                      Quick Actions
                    </h2>
                    <div className="mt-3 space-y-2 text-sm text-white/75">
                      <a
                        href="/boards"
                        className="block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-left text-xs hover:border-orange-500/30"
                      >
                        Open boards and client workspaces
                      </a>
                      <a
                        href="/timesheets/team"
                        className="block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-left text-xs hover:border-orange-500/30"
                      >
                        Review team timesheet
                      </a>
                      <button
                        onClick={() => setInviteOpen(true)}
                        className="block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-left text-xs hover:border-orange-500/30"
                      >
                        Invite collaborator
                      </button>
                      <a
                        href="/automations"
                        className="block rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs hover:border-orange-500/30"
                      >
                        Review automation runs
                      </a>
                      <a
                        href="/admin/employees"
                        className="block rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs hover:border-orange-500/30"
                      >
                        User control and password recovery
                      </a>
                    </div>
                    <a
                      href="/it/support"
                      className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-orange-500"
                    >
                      Account support tools <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              </section>

              {/* ── 5b. Support Tickets (Account Recovery) ── */}
              <section className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium text-white/60">
                    Support Tickets & Account Recovery
                  </h2>
                  <a
                    href="/it/support"
                    className="inline-flex items-center gap-1 text-xs font-medium text-orange-500"
                  >
                    View all <ArrowRight size={12} />
                  </a>
                </div>
                <SupportTicketsFeed tickets={supportTickets} limit={5} />
              </section>

              {/* ── 6. Operations Control ─────────────── */}
              <section className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Boards & Card Operations
                        </h2>
                        <p className="text-sm text-white/50">
                          Clients are boards, and tasks are cards inside those boards.
                        </p>
                      </div>
                      <a
                        href="/boards"
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
                      >
                        Open boards <ArrowRight size={14} />
                      </a>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <a
                        href="/boards"
                        className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-orange-500/30"
                      >
                        <BriefcaseBusiness size={18} className="text-orange-400" />
                        <p className="mt-3 text-2xl font-bold">
                          {stats?.totalBoards ?? 0}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          total boards / clients
                        </p>
                      </a>
                      <a
                        href={modules.find((item) => item.module === "Cards")?.route ?? "/boards"}
                        className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-orange-500/30"
                      >
                        <CheckSquare size={18} className="text-orange-400" />
                        <p className="mt-3 text-2xl font-bold">
                          {stats?.openCards ?? 0}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          open cards under boards
                        </p>
                      </a>
                      <a
                        href="/timesheets/team"
                        className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-orange-500/30"
                      >
                        <Clock3 size={18} className="text-orange-400" />
                        <p className="mt-3 text-2xl font-bold">
                          {stats?.activeTimers ?? 0}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          people tracking now
                        </p>
                      </a>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-lg font-semibold">Identity Control</h2>
                    <p className="mt-1 text-sm text-white/45">
                      Protected user lifecycle and account recovery actions live behind
                      admin/IT controls and audit logs.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <a
                        href="/it/support"
                        className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-orange-500/30"
                      >
                        <KeyRound size={18} className="text-orange-400" />
                        <p className="mt-3 text-sm font-semibold">
                          Password recovery
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          reset support and account tickets
                        </p>
                      </a>
                      <a
                        href="/admin/employees"
                        className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-orange-500/30"
                      >
                        <UserX size={18} className="text-orange-400" />
                        <p className="mt-3 text-sm font-semibold">
                          Ban / suspend users
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          service-role protected actions
                        </p>
                      </a>
                      <a
                        href="/admin/notification-deliveries"
                        className="rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-orange-500/30"
                      >
                        <Activity size={18} className="text-orange-400" />
                        <p className="mt-3 text-sm font-semibold">
                          Delivery failures
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          notification, push, and email logs
                        </p>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-sm font-semibold">Recent Audit Activity</h2>
                    <div className="mt-3 space-y-2">
                      {auditLogs.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/60">
                          No audit activity yet.
                        </div>
                      ) : (
                        auditLogs.slice(0, 8).map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white/70"
                          >
                            <p className="text-xs font-medium text-white">
                              {item.action}
                            </p>
                            <p className="mt-0.5 text-[10px] text-white/45">
                              {formatDateTime(item.created_at)}
                              {item.reason ? ` • ${item.reason}` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onInvited={async () => {
          await loadDashboard();
          await sharedDashboard.reload();
        }}
      />

    </div>
  );
}
