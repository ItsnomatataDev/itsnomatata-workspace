import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { supabase } from "../../../lib/supabase/client";
import {
  getITDashboardStats,
  type ITDashboardStats,
} from "../services/itWorkspaceService";

type IssueRow = {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  project_id: string | null;
  created_at: string;
};

export default function ITIssuesPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [issues, setIssues] = useState<IssueRow[]>([]);

  const loadPage = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [statsData, issuesRes] = await Promise.all([
        getITDashboardStats(organizationId),
        supabase
          .from("issues")
          .select(
            "id, title, description, severity, status, project_id, created_at",
          )
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false }),
      ]);

      if (issuesRes.error) throw issuesRes.error;

      setStats(statsData);
      setIssues((issuesRes.data ?? []) as IssueRow[]);
    } catch (err: any) {
      console.error("IT ISSUES LOAD ERROR:", err);
      setError(err?.message || "Failed to load issues.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading issues...
      </div>
    );
  }

  if (!user || !profile || !organizationId) {
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
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              IT Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">IT Issues</h1>
            <p className="mt-2 text-sm text-white/50">
              Real issues currently recorded in the workspace.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading issues...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : issues.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              No issues found.
            </div>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-orange-500" />
                        <h2 className="font-semibold text-white">
                          {issue.title}
                        </h2>
                      </div>
                      {issue.description ? (
                        <p className="mt-2 text-sm text-white/60">
                          {issue.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80">
                        {issue.severity}
                      </span>
                      <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs text-orange-400">
                        {issue.status}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-white/45">
                    Created: {new Date(issue.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
