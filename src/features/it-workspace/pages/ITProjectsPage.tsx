import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import ITProjectCard from "../components/ITProjectCard";
import CreateProjectModal from "../components/CreateProjectModal";
import {
  getITDashboardStats,
  getITProjectsForDashboard,
  type ITDashboardStats,
  type ITProjectDashboardItem,
} from "../services/itWorkspaceService";

export default function ITProjectsPage() {
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
  const [search, setSearch] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

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
      console.error("IT PROJECTS LOAD ERROR:", err);
      setError(err?.message || "Failed to load IT projects.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    if (!organizationId || !userId) return;
    void loadPage();
  }, [organizationId, userId, loadPage]);

  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;

    return projects.filter((project) => {
      return (
        project.name.toLowerCase().includes(term) ||
        (project.description || "").toLowerCase().includes(term) ||
        project.status.toLowerCase().includes(term) ||
        project.priority.toLowerCase().includes(term)
      );
    });
  }, [projects, search]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading IT projects...
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
              <h1 className="mt-2 text-3xl font-bold">IT Projects</h1>
              <p className="mt-2 text-sm text-white/50">
                View and manage real projects from your workspace.
              </p>
            </div>

            <button
              onClick={() => setCreateProjectOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Plus size={16} />
              New Project
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects by name, status, priority..."
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading projects...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              No projects found.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => (
                <ITProjectCard key={project.id} {...project} />
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onCreated={loadPage}
      />
    </div>
  );
}
