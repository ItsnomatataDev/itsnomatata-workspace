import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import InviteMemberModal from "../components/InviteMemberModal";
import {
  getITDashboardStats,
  getITProjectsForDashboard,
  type ITDashboardStats,
  type ITProjectDashboardItem,
} from "../services/itWorkspaceService";

export default function ITCollaborationPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [projects, setProjects] = useState<ITProjectDashboardItem[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);

  const loadPage = useCallback(async () => {
    if (!organizationId || !userId) return;

    try {
      setLoading(true);
      setError("");

      const [statsData, projectsData] = await Promise.all([
        getITDashboardStats(organizationId),
        getITProjectsForDashboard(organizationId, userId),
      ]);

      setStats(statsData);
      setProjects(projectsData);
    } catch (err: any) {
      console.error("IT COLLABORATION LOAD ERROR:", err);
      setError(err?.message || "Failed to load collaboration data.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    if (!organizationId || !userId) return;
    void loadPage();
  }, [organizationId, userId, loadPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading collaboration...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing IT workspace context.
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

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                IT Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">IT Collaboration</h1>
              <p className="mt-2 text-sm text-white/50">
                Invite teammates and review project collaboration status.
              </p>
            </div>

            <button
              onClick={() => setInviteOpen(true)}
              className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              Invite Member
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading collaboration data...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-orange-500" />
                  <div>
                    <h2 className="text-lg font-semibold">
                      Pending Invitations
                    </h2>
                    <p className="text-sm text-white/50">
                      Live count from project invitations
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="text-3xl font-bold text-white">
                    {stats?.pendingInvites ?? 0}
                  </p>
                  <p className="mt-2 text-sm text-white/55">
                    Invitations still awaiting action
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-lg font-semibold">
                  Projects Ready for Collaboration
                </h2>
                <div className="mt-4 space-y-3">
                  {projects.length === 0 ? (
                    <p className="text-sm text-white/50">No projects found.</p>
                  ) : (
                    projects.map((project) => (
                      <div
                        key={project.id}
                        className="rounded-xl border border-white/10 bg-black/30 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">
                              {project.name}
                            </p>
                            <p className="mt-1 text-sm text-white/55">
                              Members: {project.membersCount} • Health:{" "}
                              {project.healthScore}%
                            </p>
                          </div>

                          <button
                            onClick={() => setInviteOpen(true)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                          >
                            Invite
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onInvited={loadPage}
      />
    </div>
  );
}
