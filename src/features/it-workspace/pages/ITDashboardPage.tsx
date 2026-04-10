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
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import ITStatsCard from "../components/ITStatsCard";
import ITProjectCard from "../components/ITProjectCard";
import InviteMemberModal from "../components/InviteMemberModal";
import CreateProjectModal from "../components/CreateProjectModal";
import { useDashboard } from "../../../lib/hooks/useDashboard";
import {
  getITDashboardStats,
  getITProjectsForDashboard,
  getRecentITActivity,
  type ITDashboardStats,
  type ITProjectDashboardItem,
  type ITRecentActivityItem,
} from "../services/itWorkspaceService";

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

     const statsResult = await getITDashboardStats(organizationId);
     console.log("statsResult", statsResult);

     const projectsResult = await getITProjectsForDashboard(
       organizationId,
       userId,
     );
     console.log("projectsResult", projectsResult);

     const activityResult = await getRecentITActivity(organizationId, 8);
     console.log("activityResult", activityResult);

     setStats(statsResult);
     setProjects(projectsResult);
     setActivity(activityResult);
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
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                IT Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                Welcome back, {firstName}
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Manage projects, automations, collaboration, and real system
                activity.
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading IT workspace data...
            </div>
          ) : pageError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {pageError}
            </div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
                <ITStatsCard
                  title="Active Projects"
                  value={stats?.activeProjects ?? 0}
                  subtitle="Real project rows in your workspace"
                  icon={BriefcaseBusiness}
                />
                <ITStatsCard
                  title="Open Issues"
                  value={stats?.openIssues ?? 0}
                  subtitle="Open and in-progress issues"
                  icon={Bug}
                />
                <ITStatsCard
                  title="Automations"
                  value={stats?.automationCount ?? 0}
                  subtitle="Runs recorded in the last 24 hours"
                  icon={Sparkles}
                />
                <ITStatsCard
                  title="Pending Invites"
                  value={stats?.pendingInvites ?? 0}
                  subtitle="Pending project invitations"
                  icon={UserPlus}
                />
                <ITStatsCard
                  title="System Health"
                  value={stats?.systemHealthLabel ?? "Unknown"}
                  subtitle="Computed from real automation failure state"
                  icon={Activity}
                />
                <ITStatsCard
                  title="My Tasks"
                  value={sharedDashboard.stats?.openTasks ?? 0}
                  subtitle="Shared workspace task summary"
                  icon={CheckSquare}
                />
                <ITStatsCard
                  title="Tracked Today"
                  value={`${(sharedDashboard.stats as any)?.todayMinutes ?? 0}m`}
                  subtitle="Shared time tracking summary"
                  icon={Clock3}
                />
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">My Projects</h2>
                        <p className="text-sm text-white/50">
                          Real projects you belong to, with live health and risk
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
                    <h2 className="text-lg font-semibold">Recent Activity</h2>
                    <div className="mt-4 space-y-3">
                      {activity.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 text-sm text-white/60">
                          No project activity yet.
                        </div>
                      ) : (
                        activity.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/70"
                          >
                            <p className="font-medium text-white">
                              {item.action}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {item.full_name || item.email || "Unknown user"} •{" "}
                              {formatDateTime(item.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/10 to-white/5 p-5">
                    <h2 className="text-lg font-semibold">Quick Actions</h2>
                    <div className="mt-4 space-y-3 text-sm text-white/75">
                      <button
                        onClick={() => setCreateProjectOpen(true)}
                        className="block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left hover:border-orange-500/30"
                      >
                        Create a new project
                      </button>
                      <button
                        onClick={() => setInviteOpen(true)}
                        className="block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-left hover:border-orange-500/30"
                      >
                        Invite collaborator to a project
                      </button>
                      <a
                        href="/automations"
                        className="block rounded-xl border border-white/10 bg-black/40 px-4 py-3 hover:border-orange-500/30"
                      >
                        Review automation runs
                      </a>
                    </div>

                    <a
                      href="/it/projects"
                      className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-orange-500"
                    >
                      Open tools <ArrowRight size={16} />
                    </a>
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
