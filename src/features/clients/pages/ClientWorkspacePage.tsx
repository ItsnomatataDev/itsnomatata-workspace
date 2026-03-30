import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckSquare,
  BriefcaseBusiness,
  FileText,
  Image,
  Globe,
  FolderKanban,
  Clock3,
  ChevronRight,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getClientById,
  type Client,
} from "../../../lib/supabase/queries/clients";
import { supabase } from "../../../lib/supabase/client";

type ClientTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  updated_at: string;
};

type ClientCampaign = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  updated_at: string;
};

type ClientAsset = {
  id: string;
  file_name: string;
  asset_type: string;
  asset_status: string;
  created_at: string;
};

type ClientReport = {
  id: string;
  title: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
};

type WorkspaceCounts = {
  tasks: number;
  campaigns: number;
  assets: number;
  reports: number;
};

function WorkspaceCard({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
  to: string;
}) {
  return (
    <Link
      to={to}
      className={`rounded-2xl border p-5 transition ${
        value > 0
          ? "border-white/10 bg-white/5 hover:border-orange-500/40 hover:bg-white/[0.07]"
          : "border-white/5 bg-white/3 opacity-70"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{label}</p>
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
    </Link>
  );
}

function SectionCard({
  title,
  actionLabel,
  actionTo,
  children,
}: {
  title: string;
  actionLabel?: string;
  actionTo?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {actionLabel && actionTo ? (
          <Link
            to={actionTo}
            className="inline-flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-400"
          >
            {actionLabel}
            <ChevronRight size={16} />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function ClientWorkspacePage() {
  const auth = useAuth();
  const { clientId } = useParams();

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [campaigns, setCampaigns] = useState<ClientCampaign[]>([]);
  const [assets, setAssets] = useState<ClientAsset[]>([]);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [counts, setCounts] = useState<WorkspaceCounts>({
    tasks: 0,
    campaigns: 0,
    assets: 0,
    reports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  if (!auth) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading auth...
      </div>
    );
  }

  if (!auth.profile) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading profile...
      </div>
    );
  }

  const { profile } = auth;

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!clientId) {
        setError("Missing client id.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [
          clientData,
          taskCountRes,
          campaignCountRes,
          assetCountRes,
          reportCountRes,
          taskListRes,
          campaignListRes,
          assetListRes,
          reportListRes,
        ] = await Promise.all([
          getClientById(clientId),

          supabase
            .from("tasks")
            .select("id", { head: true, count: "exact" })
            .eq("client_id", clientId),

          supabase
            .from("campaigns")
            .select("id", { head: true, count: "exact" })
            .eq("client_id", clientId),

          supabase
            .from("content_assets")
            .select("id", { head: true, count: "exact" })
            .eq("client_id", clientId),

          supabase
            .from("reports")
            .select("id", { head: true, count: "exact" })
            .eq("client_id", clientId),

          supabase
            .from("tasks")
            .select("id, title, status, priority, due_date, updated_at")
            .eq("client_id", clientId)
            .order("updated_at", { ascending: false })
            .limit(6),

          supabase
            .from("campaigns")
            .select("id, name, status, start_date, end_date, updated_at")
            .eq("client_id", clientId)
            .order("updated_at", { ascending: false })
            .limit(6),

          supabase
            .from("content_assets")
            .select("id, file_name, asset_type, asset_status, created_at")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(6),

          supabase
            .from("reports")
            .select("id, title, status, period_start, period_end, created_at")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(6),
        ]);

        if (taskCountRes.error) throw taskCountRes.error;
        if (campaignCountRes.error) throw campaignCountRes.error;
        if (assetCountRes.error) throw assetCountRes.error;
        if (reportCountRes.error) throw reportCountRes.error;
        if (taskListRes.error) throw taskListRes.error;
        if (campaignListRes.error) throw campaignListRes.error;
        if (assetListRes.error) throw assetListRes.error;
        if (reportListRes.error) throw reportListRes.error;

        setClient(clientData);
        setCounts({
          tasks: taskCountRes.count ?? 0,
          campaigns: campaignCountRes.count ?? 0,
          assets: assetCountRes.count ?? 0,
          reports: reportCountRes.count ?? 0,
        });

        setTasks((taskListRes.data ?? []) as ClientTask[]);
        setCampaigns((campaignListRes.data ?? []) as ClientCampaign[]);
        setAssets((assetListRes.data ?? []) as ClientAsset[]);
        setReports((reportListRes.data ?? []) as ClientReport[]);
      } catch (err) {
        console.error("CLIENT WORKSPACE ERROR:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load client workspace",
        );
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [clientId]);

  const workspaceCards = useMemo(() => {
    return [
      {
        label: "Tasks",
        value: counts.tasks,
        icon: CheckSquare,
        to: "/tasks",
      },
      {
        label: "Campaigns",
        value: counts.campaigns,
        icon: BriefcaseBusiness,
        to: "/campaigns",
      },
      {
        label: "Assets",
        value: counts.assets,
        icon: Image,
        to: "/content-library",
      },
      {
        label: "Reports",
        value: counts.reports,
        icon: FileText,
        to: "/reports",
      },
    ];
  }, [counts]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading workspace...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : !client ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Client workspace not found.
            </div>
          ) : (
            <>
              <div className="mb-8">
                <Link
                  to={`/clients/${client.id}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-orange-500 hover:text-orange-400"
                >
                  <ArrowLeft size={16} />
                  Back to Client Details
                </Link>

                <p className="mt-4 text-xs uppercase tracking-[0.3em] text-orange-500">
                  Client Workspace
                </p>
                <h1 className="mt-2 text-3xl font-bold">{client.name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/50">
                  Live workspace overview powered by real client-linked data
                  from Supabase.
                </p>
              </div>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="rounded-2xl bg-orange-500/15 p-4 text-orange-500">
                    <Building2 size={24} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-semibold">{client.name}</h2>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase text-white/60">
                        {client.status}
                      </span>
                      {client.industry ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60">
                          {client.industry}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-white/70">
                      {client.description ||
                        "No client description available yet."}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/55">
                      <div className="flex items-center gap-2">
                        <FolderKanban size={15} className="text-orange-500" />
                        <span>Slug: {client.slug}</span>
                      </div>

                      {client.website_url ? (
                        <div className="flex items-center gap-2">
                          <Globe size={15} className="text-orange-500" />
                          <a
                            href={client.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-orange-400 hover:text-orange-300"
                          >
                            {client.website_url}
                          </a>
                        </div>
                      ) : null}

                      {client.brand_voice ? (
                        <div className="flex items-center gap-2">
                          <Clock3 size={15} className="text-orange-500" />
                          <span>Brand voice: {client.brand_voice}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {workspaceCards.map((card) => (
                  <WorkspaceCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    icon={card.icon}
                    to={card.to}
                  />
                ))}
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <SectionCard
                  title="Recent Tasks"
                  actionLabel="Open Tasks"
                  actionTo="/tasks"
                >
                  {tasks.length === 0 ? (
                    <p className="text-sm text-white/50">
                      No tasks linked to this client yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {task.title}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-wide text-white/45">
                                {task.status.replaceAll("_", " ")} ·{" "}
                                {task.priority}
                              </p>
                            </div>
                            {task.due_date ? (
                              <span className="text-xs text-orange-400">
                                {new Date(task.due_date).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Recent Campaigns"
                  actionLabel="Open Campaigns"
                  actionTo="/campaigns"
                >
                  {campaigns.length === 0 ? (
                    <p className="text-sm text-white/50">
                      No campaigns linked to this client yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {campaigns.map((campaign) => (
                        <div
                          key={campaign.id}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {campaign.name}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-wide text-white/45">
                                {campaign.status.replaceAll("_", " ")}
                              </p>
                            </div>
                            {campaign.start_date ? (
                              <span className="text-xs text-orange-400">
                                {new Date(
                                  campaign.start_date,
                                ).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Recent Assets"
                  actionLabel="Open Library"
                  actionTo="/content-library"
                >
                  {assets.length === 0 ? (
                    <p className="text-sm text-white/50">
                      No assets uploaded for this client yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {assets.map((asset) => (
                        <div
                          key={asset.id}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {asset.file_name}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-wide text-white/45">
                                {asset.asset_type} · {asset.asset_status}
                              </p>
                            </div>
                            <span className="text-xs text-orange-400">
                              {new Date(asset.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Recent Reports"
                  actionLabel="Open Reports"
                  actionTo="/reports"
                >
                  {reports.length === 0 ? (
                    <p className="text-sm text-white/50">
                      No reports available for this client yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {reports.map((report) => (
                        <div
                          key={report.id}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {report.title}
                              </p>
                              <p className="mt-1 text-xs uppercase tracking-wide text-white/45">
                                {report.status.replaceAll("_", " ")}
                              </p>
                            </div>
                            <span className="text-xs text-orange-400">
                              {new Date(report.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
