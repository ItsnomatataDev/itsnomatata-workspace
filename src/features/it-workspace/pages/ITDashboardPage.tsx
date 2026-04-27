import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Bug,
  Sparkles,
  UserPlus,
  Activity,
  ArrowRight,
  CheckSquare,
  Clock3,
  Shield,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import ITStatsCard from "../components/ITStatsCard";
import ITProjectCard from "../components/ITProjectCard";
import InviteMemberModal from "../components/InviteMemberModal";
import CreateProjectModal from "../components/CreateProjectModal";
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
  getITProjectsForDashboard,
  getRecentITActivity,
  type ITDashboardStats,
  type ITProjectDashboardItem,
  type ITRecentActivityItem,
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

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function ITDashboardPage() {
  const auth = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [projects, setProjects] = useState<ITProjectDashboardItem[]>([]);
  const [activity, setActivity] = useState<ITRecentActivityItem[]>([]);
  const [modules, setModules] = useState<ModuleHealthItem[]>([]);
  const [teamPulse, setTeamPulse] = useState<TeamPulseMember[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [kpis, setKpis] = useState<KPITile[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const loading = auth?.loading ?? true;

  const firstName = useMemo(() => {
    const fullName =
      profile?.full_name ||
      user?.user_metadata?.full_name ||
      user?.email ||
      "User";

    return String(fullName).split(" ")[0];
  }, [profile?.full_name, user?.user_metadata?.full_name, user?.email]);

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
        projectsResult,
        activityResult,
        modulesResult,
        pulseResult,
        escalationsResult,
        kpisResult,
        ticketsResult,
      ] = await Promise.all([
        getITDashboardStats(organizationId),
        getITProjectsForDashboard(organizationId, userId),
        getRecentITActivity(organizationId, 8),
        getCrossModuleHealth(organizationId),
        getTeamPulse(organizationId),
        getEscalationItems(organizationId),
        getKPITiles(organizationId),
        getSupportTickets(organizationId, {
          status: ["open", "in_progress", "waiting_on_user"],
          limit: 8,
        }),
      ]);

      setStats(statsResult);
      setProjects(projectsResult);
      setActivity(activityResult);
      setModules(modulesResult);
      setTeamPulse(pulseResult);
      setEscalations(escalationsResult);
      setKpis(kpisResult);
      setSupportTickets(ticketsResult);
    } catch (err: any) {
      console.error("IT DASHBOARD LOAD ERROR:", err);
      setPageError(err?.message || "Failed to load IT dashboard.");
    } finally {
      setPageLoading(false);
    }
  }, [organizationId, userId]);
  useEffect(() => {
    if (!organizationId || !userId) return;
    void loadDashboard();
  }, [organizationId, userId, loadDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading IT dashboard...
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Unable to load your IT workspace.
      </div>
    );
  }

  if (!organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Your IT account is missing organization or user context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.primary_role}
          counts={{
            projects: stats?.activeProjects ?? 0,
            pendingInvites: stats?.pendingInvites ?? 0,
            openIssues: stats?.openIssues ?? 0,
          }}
        />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
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

            <div className="flex gap-3">
              <button
                onClick={() => setInviteOpen(true)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Invite Member
              </button>
              <button
                onClick={() => setCreateProjectOpen(true)}
                className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
              >
                New Project
              </button>
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
                  title="Active Projects"
                  value={stats?.activeProjects ?? 0}
                  subtitle="Real project rows"
                  icon={BriefcaseBusiness}
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
                  title="Pending Invites"
                  value={stats?.pendingInvites ?? 0}
                  subtitle="Awaiting acceptance"
                  icon={UserPlus}
                />
                <ITStatsCard
                  title="System Health"
                  value={stats?.systemHealthLabel ?? "Unknown"}
                  subtitle="Automation failure state"
                  icon={Activity}
                />
                <ITStatsCard
                  title="My Tasks"
                  value={sharedDashboard.stats?.openTasks ?? 0}
                  subtitle="Open tasks assigned"
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
                    userName={profile.full_name ?? null}
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
                    fullName={profile.full_name ?? null}
                    email={user.email ?? ""}
                  />

                  <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/10 to-white/5 p-5">
                    <h2 className="text-sm font-semibold text-white">
                      Quick Actions
                    </h2>
                    <div className="mt-3 space-y-2 text-sm text-white/75">
                      <button
                        onClick={() => setCreateProjectOpen(true)}
                        className="block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-left text-xs hover:border-orange-500/30"
                      >
                        Create a new project
                      </button>
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
                    </div>
                    <a
                      href="/it/projects"
                      className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-orange-500"
                    >
                      All IT tools <ArrowRight size={14} />
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

              {/* ── 6. Projects + Activity ─────────────── */}
              <section className="grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">My Projects</h2>
                        <p className="text-sm text-white/50">
                          Live health and risk scoring
                        </p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {projects.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/60">
                          No projects found yet. Create your first project.
                        </div>
                      ) : (
                        projects.map((project) => (
                          <ITProjectCard key={project.id} {...project} />
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-sm font-semibold">Recent Activity</h2>
                    <div className="mt-3 space-y-2">
                      {activity.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/60">
                          No project activity yet.
                        </div>
                      ) : (
                        activity.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white/70"
                          >
                            <p className="text-xs font-medium text-white">
                              {item.action}
                            </p>
                            <p className="mt-0.5 text-[10px] text-white/45">
                              {item.full_name || item.email || "Unknown user"} •{" "}
                              {formatDateTime(item.created_at)}
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

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onCreated={async () => {
          await loadDashboard();
          await sharedDashboard.reload();
        }}
      />
    </div>
  );
}
